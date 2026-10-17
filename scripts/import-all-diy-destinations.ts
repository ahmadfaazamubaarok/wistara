// Skrip impor lengkap destinasi wisata seluruh Daerah Istimewa Yogyakarta dari OpenStreetMap.
// Membaca seluruh objek wisata di DIY, membersihkan nama, mengklasifikasi kategori,
// dan memetakan ke wilayah cuaca (adm4_code) terdekat.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { overpass, type OverpassElement } from "./lib/overpass";

type DestCategory = "pantai" | "alam" | "budaya" | "museum" | "desa_wisata";

type DestinationItem = {
  slug: string;
  name: string;
  category: DestCategory;
  isIndoor: boolean;
  adm4Code: string;
  lat: number;
  lon: number;
  openHours: Record<string, string[] | undefined> | null;
  description: string;
  osmRef: string | null;
  verifiedAt: string | null;
};

type RegionItem = {
  adm4Code: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  lat?: number;
  lon?: number;
};

const SEED_DIR = path.resolve(process.cwd(), "supabase/seed");

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 75);
}

function categorize(name: string, tags: Record<string, string>): DestCategory {
  const lower = name.toLowerCase();

  // 1. Pantai
  if (
    tags.natural === "beach" ||
    lower.includes("pantai") ||
    lower.includes("beach") ||
    lower.includes("pesisir")
  ) {
    return "pantai";
  }

  // 2. Museum
  if (
    tags.tourism === "museum" ||
    lower.includes("museum") ||
    lower.includes("monumen") ||
    lower.includes("benteng") ||
    lower.includes("galeri") ||
    lower.includes("gallery") ||
    lower.includes("art center") ||
    lower.includes("memorial")
  ) {
    return "museum";
  }

  // 3. Desa Wisata
  if (
    lower.includes("desa wisata") ||
    lower.includes("kampung wisata") ||
    lower.includes("desa budaya") ||
    lower.includes("dusun wisata") ||
    lower.includes("ecotourism")
  ) {
    return "desa_wisata";
  }

  // 4. Budaya
  if (
    tags.historic === "archaeological_site" ||
    tags.historic === "castle" ||
    tags.historic === "ruins" ||
    tags.historic === "temple" ||
    tags.heritage ||
    lower.includes("candi") ||
    lower.includes("keraton") ||
    lower.includes("kraton") ||
    lower.includes("pura") ||
    lower.includes("makam") ||
    lower.includes("situs") ||
    lower.includes("pesanggrahan") ||
    lower.includes("petilasan") ||
    lower.includes("masjid gedhe") ||
    lower.includes("taman sari") ||
    lower.includes("dalem ") ||
    lower.includes("kotagede") ||
    lower.includes("alun-alun")
  ) {
    return "budaya";
  }

  // 5. Alam (default)
  return "alam";
}

function generateDescription(name: string, category: DestCategory, kabupaten: string): string {
  switch (category) {
    case "pantai":
      return `Wisata pantai ${name} berpanorama pesisir samudra Hindia di ${kabupaten}, Daerah Istimewa Yogyakarta.`;
    case "budaya":
      return `Situs warisan sejarah dan cagar budaya ${name} yang kaya akan nilai historis di ${kabupaten}, Yogyakarta.`;
    case "museum":
      return `Pusat edukasi dan preservasi seni budaya di ${name}, ${kabupaten}, Daerah Istimewa Yogyakarta.`;
    case "desa_wisata":
      return `Kawasan desa wisata ${name} dengan kearifan lokal, tradisi budaya, dan keasrian pedesaan di ${kabupaten}.`;
    case "alam":
    default:
      return `Destinasi wisata alam ${name} dengan panorama asri dan udara segar di ${kabupaten}, Daerah Istimewa Yogyakarta.`;
  }
}

async function run() {
  console.log("=== Memulai Pengambilan Data Wisata Seluruh DIY dari OpenStreetMap ===");

  // Bounding box DIY
  const query = `
    [out:json][timeout:60];
    (
      node["tourism"~"attraction|museum|theme_park|viewpoint"](-8.25,109.95,-7.50,110.90);
      way["tourism"~"attraction|museum|theme_park|viewpoint"](-8.25,109.95,-7.50,110.90);
      node["natural"="beach"](-8.25,109.95,-7.50,110.90);
      way["natural"="beach"](-8.25,109.95,-7.50,110.90);
      node["historic"~"archaeological_site|castle|monument|ruins"](-8.25,109.95,-7.50,110.90);
      way["historic"~"archaeological_site|castle|monument|ruins"](-8.25,109.95,-7.50,110.90);
    );
    out tags center;
  `;

  const elements: OverpassElement[] = await overpass(query);
  console.log(`Ditemukan ${elements.length} objek wisata mentah dari OSM.`);

  // Muat data daerah dan destinasi saat ini
  const regionsFile = path.join(SEED_DIR, "regions.json");
  const destFile = path.join(SEED_DIR, "destinations.json");

  const regions: RegionItem[] = JSON.parse(await readFile(regionsFile, "utf8"));
  const existingDest: DestinationItem[] = JSON.parse(await readFile(destFile, "utf8"));

  // Perkiraan titik pusat per region dari destinasi yang sudah terdaftar
  const regionCoords = new Map<string, { lat: number; lon: number }>();
  for (const d of existingDest) {
    if (!regionCoords.has(d.adm4Code)) {
      regionCoords.set(d.adm4Code, { lat: d.lat, lon: d.lon });
    }
  }

  // Filter kata-kata non-wisata
  const excludedRegex =
    /hotel|homestay|villa|guest\s*house|kost|resort|resto|cafe|coffee|warung|toko|shop|pos|loket|kantor|balai|toilet|mushola|masjid|spbu|indomaret|alfamart|atm|parkir|pintu\s*masuk|gerbang|gazebo|gardu\s*pandang\s*[0-9]+|spot\s*foto\s*[0-9]+/i;

  const destMap = new Map<string, DestinationItem>();
  for (const d of existingDest) {
    destMap.set(d.slug, d);
  }

  const seenNames = new Set(existingDest.map((d) => d.name.toLowerCase().replace(/[^a-z0-9]/g, "")));

  let addedCount = 0;

  for (const e of elements) {
    const rawName = e.tags?.name?.trim();
    if (!rawName || rawName.length < 3) continue;
    if (excludedRegex.test(rawName)) continue;

    const normalizedName = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seenNames.has(normalizedName)) continue;

    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!lat || !lon) continue;

    // Batas koordinat DIY yang wajar
    if (lat > -7.52 || lat < -8.23 || lon < 110.0 || lon > 110.85) continue;

    // Tentukan wilayah adm4_code terdekat
    let bestRegion = regions[0];
    let bestDist = Infinity;
    for (const r of regions) {
      const coord = regionCoords.get(r.adm4Code) ?? { lat: -7.797, lon: 110.37 };
      const dist = distanceKm(lat, lon, coord.lat, coord.lon);
      if (dist < bestDist) {
        bestDist = dist;
        bestRegion = r;
      }
    }

    let baseSlug = slugify(rawName);
    if (!baseSlug) baseSlug = `wisata-${e.id}`;
    let slug = baseSlug;
    let counter = 2;
    while (destMap.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const category = categorize(rawName, e.tags ?? {});
    const isIndoor = category === "museum" || e.tags?.indoor === "yes";

    const newItem: DestinationItem = {
      slug,
      name: rawName,
      category,
      isIndoor,
      adm4Code: bestRegion.adm4Code,
      lat: Math.round(lat * 10000) / 10000,
      lon: Math.round(lon * 10000) / 10000,
      openHours: null,
      description: generateDescription(rawName, category, bestRegion.kabupaten),
      osmRef: `${e.type}/${e.id}`,
      verifiedAt: null,
    };

    destMap.set(slug, newItem);
    seenNames.add(normalizedName);
    addedCount++;
  }

  const allDestinations = [...destMap.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));

  await writeFile(destFile, JSON.stringify(allDestinations, null, 2), "utf8");

  console.log(`Berhasil menambahkan ${addedCount} destinasi wisata baru.`);
  console.log(`Total destinasi wisata di sistem kini: ${allDestinations.length} destinasi.`);
}

run().catch((err) => {
  console.error("Gagal impor destinasi:", err);
  process.exit(1);
});
