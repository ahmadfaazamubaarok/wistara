// Skrip impor pengayaan fasilitas dan toilet se-DIY dari OpenStreetMap (Overpass)
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { overpass, pointOf, sleep, type OverpassElement } from "./lib/overpass";

const SEED_DIR = path.resolve(process.cwd(), "supabase/seed");

type FacilityType = "toilet" | "parkir" | "makan" | "ibadah" | "atm" | "halte" | "stasiun";

type SeedFacility = {
  osmType: string;
  osmId: number;
  type: FacilityType;
  name: string | null;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

const AMENITY_TYPE: Record<string, FacilityType> = {
  toilets: "toilet",
  parking: "parkir",
  restaurant: "makan",
  cafe: "makan",
  fast_food: "makan",
  atm: "atm",
  place_of_worship: "ibadah",
};

function classify(tags: Record<string, string>): FacilityType | null {
  if (tags.amenity && tags.amenity in AMENITY_TYPE) return AMENITY_TYPE[tags.amenity];
  if (tags.highway === "bus_stop") return "halte";
  if (tags.railway === "station") return "stasiun";
  return null;
}

function toFacility(element: OverpassElement): SeedFacility | null {
  const tags = element.tags ?? {};
  const type = classify(tags);
  const point = pointOf(element);
  if (!type || !point) return null;
  return {
    osmType: element.type,
    osmId: element.id,
    type,
    name: tags.name?.trim() || (type === "toilet" ? "Toilet Umum" : null),
    lat: Number(point.lat.toFixed(7)),
    lon: Number(point.lon.toFixed(7)),
    tags,
  };
}

async function main() {
  console.log("=== Mengimpor Fasilitas & Toilet Se-DIY dari OpenStreetMap ===");

  const existingFile = path.join(SEED_DIR, "facilities.json");
  const existingList: SeedFacility[] = JSON.parse(await readFile(existingFile, "utf8"));
  console.log(`Fasilitas awal di facilities.json: ${existingList.length} titik`);

  const facilityMap = new Map<string, SeedFacility>();
  for (const f of existingList) {
    facilityMap.set(`${f.osmType}/${f.osmId}`, f);
  }

  // 1. Ambil seluruh toilet di area DIY
  console.log("1. Mengambil seluruh toilet di provinsi DIY...");
  const toiletQuery = `[out:json][timeout:90];
  area["name"="Daerah Istimewa Yogyakarta"]["admin_level"="4"]->.diy;
  (
    nwr(area.diy)[amenity=toilets];
  );
  out center tags;`;

  try {
    const toiletElements = await overpass(toiletQuery);
    let newToilets = 0;
    for (const el of toiletElements) {
      const fac = toFacility(el);
      if (fac) {
        const key = `${fac.osmType}/${fac.osmId}`;
        if (!facilityMap.has(key)) newToilets++;
        facilityMap.set(key, fac);
      }
    }
    console.log(`Ditemukan ${toiletElements.length} toilet di OSM se-DIY (+${newToilets} baru ditambahkan)`);
  } catch (err) {
    console.warn("Peringatan saat mengambil toilet se-DIY:", err instanceof Error ? err.message : err);
  }

  await sleep(3000);

  // 2. Ambil fasilitas di sekitar koordinat destinasi-destinasi baru
  const newSpotCoords = [
    { name: "Tebing Breksi & Candi Ijo", lat: -7.7825, lon: 110.508 },
    { name: "Candi Sambisari", lat: -7.76258, lon: 110.44715 },
    { name: "Museum Gunungapi Merapi & Kaliurang", lat: -7.605, lon: 110.428 },
    { name: "Goa Pindul", lat: -7.9338, lon: 110.6481 },
    { name: "Pantai Drini", lat: -8.1362, lon: 110.5779 },
    { name: "Pantai Wediombo", lat: -8.1834, lon: 110.7092 },
    { name: "Puncak Becici & Pinus Pengger", lat: -7.895, lon: 110.443 },
    { name: "Pantai Goa Cemara", lat: -7.9992, lon: 110.2483 },
    { name: "Waduk Sermo", lat: -7.8285, lon: 110.1215 },
    { name: "Museum Perjuangan & Warungboto", lat: -7.815, lon: 110.381 },
    { name: "Blue Lagoon Ngemplak", lat: -7.7121, lon: 110.4398 },
    { name: "Puncak Suroloyo", lat: -7.6534, lon: 110.1818 },
  ];

  console.log(`2. Mengambil fasilitas di sekitar ${newSpotCoords.length} kawasan destinasi baru...`);
  for (const spot of newSpotCoords) {
    console.log(`Mengambil fasilitas untuk ${spot.name}...`);
    const q = `[out:json][timeout:60];
    (
      nwr(around:1500,${spot.lat},${spot.lon})[amenity~"^(toilets|parking|restaurant|cafe|fast_food|atm|place_of_worship)$"];
      nwr(around:1500,${spot.lat},${spot.lon})[highway=bus_stop];
      nwr(around:5000,${spot.lat},${spot.lon})[railway=station];
    );
    out center tags;`;

    try {
      const elements = await overpass(q);
      let added = 0;
      for (const el of elements) {
        const fac = toFacility(el);
        if (fac) {
          const key = `${fac.osmType}/${fac.osmId}`;
          if (!facilityMap.has(key)) added++;
          facilityMap.set(key, fac);
        }
      }
      console.log(`-> ${spot.name}: ${elements.length} titik ditemukan (+${added} baru)`);
    } catch (err) {
      console.warn(`Gagal mengambil fasilitas ${spot.name}:`, err instanceof Error ? err.message : err);
    }
    await sleep(2500);
  }

  const allFacilities = [...facilityMap.values()].sort(
    (a, b) => a.osmType.localeCompare(b.osmType) || a.osmId - b.osmId,
  );

  await writeFile(existingFile, JSON.stringify(allFacilities, null, 2), "utf8");
  console.log(`\n=== Selesai! Total fasilitas kini: ${allFacilities.length} titik tersimpan di facilities.json ===`);
  const byType: Record<string, number> = {};
  allFacilities.forEach((f) => (byType[f.type] = (byType[f.type] || 0) + 1));
  console.log("Rincian per tipe fasilitas:", byType);
}

main().catch((err) => {
  console.error("Gagal menjalankan impor fasilitas:", err);
  process.exit(1);
});
