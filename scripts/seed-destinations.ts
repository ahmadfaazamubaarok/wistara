// Skrip SEKALI JALAN: menyiapkan supabase/seed/destinations.json dan regions.json
// dari daftar kurasi (destinations.curated.json).
//
//   1. Koordinat dan osm_ref dari OSM (Overpass), sesuai F1 "kurasi tim + koordinat OSM".
//   2. Wilayah resmi (kabupaten/kecamatan/desa) dari data kurasi, dicocokkan ke daftar
//      kode Kepmendagri (wilayah-diy.json), lalu kodenya DIVALIDASI ke API BMKG
//      (kode tidak dikenal = 404). Nama desa di respons BMKG harus sama dengan data kurasi.
//   3. Nominatim (OSM) hanya pembanding: ketidaksesuaian ditandai agar ditinjau manusia,
//      tidak menggagalkan proses.
//
// Progres tiap destinasi disimpan di /tmp, jadi menjalankan ulang setelah gangguan
// jaringan hanya mengerjakan yang gagal. Hapus /tmp/jl-destinations-progress.json
// untuk mengulang dari awal.
//
// Jalankan: docker compose exec app npm run seed:destinations
// Hasilnya di-commit, jadi skrip ini tidak perlu dijalankan lagi kecuali daftar berubah.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BmkgError, fetchBmkgForecast } from "../src/lib/bmkg/client";
import { openHoursSchema, type OpenHours } from "../src/lib/scoring/open-hours";
import { sleep } from "./lib/overpass";

type Curated = {
  slug: string;
  name: string;
  category: "pantai" | "alam" | "budaya" | "museum" | "desa_wisata";
  isIndoor: boolean;
  osmNamePattern: string;
  /** Kata kunci pencarian di OSM bila berbeda dari `name`. */
  osmQuery?: string;
  /** True bila OSM tidak punya objek yang tepat: pakai koordinat `fallback` (perkiraan, harus diperiksa tim). */
  useFallback?: boolean;
  fallback: { lat: number; lon: number };
  wilayah: { kabupaten: string; kecamatan: string; desa: string };
  openHours: OpenHours | null;
  description: string;
};

type Region = { adm4Code: string; desa: string; kecamatan: string; kabupaten: string };
type Resolved = { destination: Record<string, unknown>; region: Region; report: Record<string, string> };

const SEED_DIR = path.resolve(process.cwd(), "supabase/seed");
const PROGRESS_FILE = "/tmp/jl-destinations-progress.json";
const BMKG_GAP_MS = 1200; // jauh di bawah batas 60 permintaan/menit
const NOMINATIM_GAP_MS = 2000; // kebijakan Nominatim: maksimal 1 permintaan/detik
const MAX_FALLBACK_DISTANCE_KM = 6;
const USER_AGENT = "JelajahLokal-import/0.1 (proyek mahasiswa UINIC 8.0; impor sekali)";

const normalize = (text: string) =>
  text
    .toUpperCase()
    .replace(/^(KABUPATEN|KAB\.?|KOTA|KECAMATAN|KEC\.?|KAPANEWON|KELURAHAN|KALURAHAN|DESA)\s+/, "")
    .replace(/[^A-Z0-9]/g, "");

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

type NominatimHit = {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  category?: string;
  type?: string;
  name?: string;
  importance?: number;
};

function rankHit(hit: NominatimHit): number {
  let score = (hit.importance ?? 0) * 2;
  if (hit.category && /^(tourism|historic|natural|leisure)$/.test(hit.category)) score += 4;
  if (hit.category && /^(amenity|shop|highway|railway|building)$/.test(hit.category)) score -= 4;
  if (hit.type && /^(attraction|museum|beach|peak|dune|wood|viewpoint|archaeological_site|castle|monument|ruins|temple|village)$/.test(hit.type)) score += 2;
  return score;
}

/** Koordinat dari pencarian nama di Nominatim (lebih ringan daripada Overpass untuk 20 nama). */
async function locate(curated: Curated) {
  if (curated.useFallback) {
    return { point: curated.fallback, osmRef: null as string | null, warn: "koordinat PERKIRAAN (OSM tidak punya objeknya), tim perlu memeriksa" };
  }
  await sleep(NOMINATIM_GAP_MS);
  const params = new URLSearchParams({
    q: curated.osmQuery ?? curated.name,
    format: "jsonv2",
    limit: "10",
    viewbox: "109.95,-7.5,110.9,-8.25", // kiri,atas,kanan,bawah = DIY
    bounded: "1",
    "accept-language": "id",
  });
  let hits: NominatimHit[] = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        hits = (await response.json()) as NominatimHit[];
        break;
      }
    } catch {
      /* gangguan jaringan sesaat: coba lagi di bawah */
    }
    await sleep(NOMINATIM_GAP_MS * attempt);
  }

  const pattern = new RegExp(curated.osmNamePattern, "i");
  const best = hits
    .filter((hit) => hit.name && pattern.test(hit.name) && ["node", "way", "relation"].includes(hit.osm_type))
    .map((hit) => ({ hit, score: rankHit(hit) }))
    .sort((a, b) => b.score - a.score)[0];

  if (!best) {
    return { point: curated.fallback, osmRef: null as string | null, warn: "OSM tidak ketemu, memakai koordinat cadangan (perkiraan, periksa)" };
  }
  const point = { lat: Number(best.hit.lat), lon: Number(best.hit.lon) };
  const away = distanceKm(point, curated.fallback);
  return {
    point,
    osmRef: `${best.hit.osm_type}/${best.hit.osm_id}`,
    warn: away > MAX_FALLBACK_DISTANCE_KM ? `koordinat OSM ${away.toFixed(1)} km dari perkiraan, periksa objek OSM-nya` : null,
  };
}

/** Cari kode di daftar Kepmendagri: kabupaten -> kecamatan -> desa. */
function lookupCode(wilayah: Record<string, string>, hint: Curated["wilayah"]) {
  const children = (parent: string, pattern: RegExp) =>
    Object.entries(wilayah).filter(([code]) => code.startsWith(`${parent}.`) && pattern.test(code.slice(parent.length + 1)));
  const named = (entries: [string, string][], name: string) =>
    entries.filter(([, n]) => normalize(n) === normalize(name));

  const kab = named(Object.entries(wilayah).filter(([code]) => /^34\.\d{2}$/.test(code)), hint.kabupaten);
  if (kab.length !== 1) throw new Error(`Kabupaten "${hint.kabupaten}" ${kab.length === 0 ? "tidak ada" : "ambigu"} di daftar wilayah`);
  const kec = named(children(kab[0][0], /^\d{2}$/), hint.kecamatan);
  if (kec.length !== 1) throw new Error(`Kecamatan "${hint.kecamatan}" ${kec.length === 0 ? "tidak ada" : "ambigu"} di ${kab[0][1]}`);
  const desa = named(children(kec[0][0], /^\d{4}$/), hint.desa);
  if (desa.length !== 1) throw new Error(`Desa "${hint.desa}" ${desa.length === 0 ? "tidak ada" : "ambigu"} di ${kec[0][1]}`);
  return { code: desa[0][0], desa: desa[0][1] };
}

async function validateWithBmkg(code: string, expectedDesa: string) {
  await sleep(BMKG_GAP_MS);
  try {
    const forecast = await fetchBmkgForecast(code, { retries: 4 });
    if (normalize(forecast.location.desa) !== normalize(expectedDesa)) {
      throw new Error(`BMKG menamai ${code} "${forecast.location.desa}", bukan "${expectedDesa}"`);
    }
    return forecast;
  } catch (error) {
    if (error instanceof BmkgError && error.status === 404) throw new Error(`BMKG tidak mengenal kode ${code}`);
    throw error;
  }
}

/** Pembanding independen: apa kata Nominatim tentang desa dan kecamatan titik ini? */
async function crossCheck(point: { lat: number; lon: number }, hint: Curated["wilayah"]): Promise<string> {
  await sleep(NOMINATIM_GAP_MS);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${point.lat}&lon=${point.lon}&format=jsonv2&zoom=16&addressdetails=1&accept-language=id`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return `Nominatim HTTP ${response.status}`;
    const { address = {} } = (await response.json()) as { address?: Record<string, string> };
    const values = Object.values(address).map(normalize);
    const desaOk = values.includes(normalize(hint.desa));
    const kecOk = values.includes(normalize(hint.kecamatan));
    if (desaOk && kecOk) return "cocok";
    const seen = ["village", "suburb", "neighbourhood", "city_district", "municipality", "county"]
      .map((key) => address[key]).filter(Boolean).join(" / ");
    return `BERBEDA: desa ${desaOk ? "ok" : "x"}, kecamatan ${kecOk ? "ok" : "x"} (Nominatim: ${seen || "-"})`;
  } catch (error) {
    return `Nominatim gagal (${error instanceof Error ? error.message : error})`;
  }
}

async function main() {
  const curated = JSON.parse(await readFile(path.join(SEED_DIR, "destinations.curated.json"), "utf8")) as Curated[];
  const wilayah = JSON.parse(await readFile(path.join(SEED_DIR, "wilayah-diy.json"), "utf8")) as Record<string, string>;

  // Gagal cepat bila data kurasi salah, sebelum memanggil jaringan.
  const slugs = new Set<string>();
  for (const item of curated) {
    if (item.openHours !== null) openHoursSchema.parse(item.openHours);
    if (!/^[a-z0-9-]{1,80}$/.test(item.slug)) throw new Error(`Slug tidak valid: ${item.slug}`);
    if (slugs.has(item.slug)) throw new Error(`Slug ganda: ${item.slug}`);
    slugs.add(item.slug);
    lookupCode(wilayah, item.wilayah);
  }

  const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7).split(",");
  const targets = only ? curated.filter((item) => only.includes(item.slug)) : curated;

  const progress: Record<string, Resolved> = existsSync(PROGRESS_FILE)
    ? JSON.parse(await readFile(PROGRESS_FILE, "utf8"))
    : {};
  const failures: string[] = [];

  for (const item of targets) {
    if (progress[item.slug]) {
      console.log(`[${item.slug}] sudah selesai (progres), dilewati`);
      continue;
    }
    try {
      console.log(`[${item.slug}] mencari koordinat di OSM (Nominatim)...`);
      const located = await locate(item);

      const { code, desa } = lookupCode(wilayah, item.wilayah);
      const forecast = await validateWithBmkg(code, desa);
      const check = await crossCheck(located.point, item.wilayah);

      const { kecamatan, kabupaten } = forecast.location;
      // Uji kewajaran: titik destinasi seharusnya dekat dengan pusat desa menurut BMKG.
      const { lat: centerLat, lon: centerLon } = forecast.location;
      const fromCenter = centerLat !== null && centerLon !== null
        ? distanceKm(located.point, { lat: centerLat, lon: centerLon })
        : null;
      const warnings = [
        located.warn,
        fromCenter !== null && fromCenter > 6 ? `${fromCenter.toFixed(1)} km dari pusat desa BMKG, periksa koordinat` : null,
      ].filter(Boolean).join("; ");
      progress[item.slug] = {
        region: { adm4Code: code, desa: forecast.location.desa, kecamatan, kabupaten },
        destination: {
          slug: item.slug,
          name: item.name,
          category: item.category,
          isIndoor: item.isIndoor,
          adm4Code: code,
          lat: Number(located.point.lat.toFixed(6)),
          lon: Number(located.point.lon.toFixed(6)),
          openHours: item.openHours,
          description: item.description,
          osmRef: located.osmRef,
          verifiedAt: null,
        },
        report: {
          slug: item.slug,
          osm: located.osmRef ?? "(cadangan)",
          adm4: code,
          bmkg: `${forecast.location.desa}, ${kecamatan}, ${kabupaten}`,
          nominatim: check,
          jarakKePusatDesaKm: fromCenter === null ? "-" : fromCenter.toFixed(1),
          catatan: warnings,
        },
      };
      await writeFile(PROGRESS_FILE, JSON.stringify(progress));
      console.log(`[${item.slug}] OK ${code} (${check})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${item.slug}: ${message}`);
      console.error(`[${item.slug}] GAGAL: ${message}`);
    }
  }

  console.log("\n=== Ringkasan ===");
  for (const item of targets) if (progress[item.slug]) console.log(JSON.stringify(progress[item.slug].report));

  if (failures.length > 0) {
    console.error(`\n${failures.length} destinasi gagal; berkas seed TIDAK ditulis. Jalankan ulang untuk mengulang yang gagal:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
  if (only) {
    console.log("\nMode --only: tidak menulis berkas (jalankan tanpa --only untuk menghasilkan seed lengkap).");
    return;
  }

  const destinations = curated.map((item) => progress[item.slug].destination);
  const regions = new Map<string, Region>();
  for (const item of curated) regions.set(progress[item.slug].region.adm4Code, progress[item.slug].region);

  await writeFile(path.join(SEED_DIR, "destinations.json"), `${JSON.stringify(destinations, null, 2)}\n`);
  await writeFile(
    path.join(SEED_DIR, "regions.json"),
    `${JSON.stringify([...regions.values()].sort((a, b) => a.adm4Code.localeCompare(b.adm4Code)), null, 2)}\n`,
  );
  console.log(`\nSelesai: ${destinations.length} destinasi, ${regions.size} wilayah ditulis ke supabase/seed/.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
