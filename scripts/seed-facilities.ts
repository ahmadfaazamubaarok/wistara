// Skrip SEKALI JALAN: mengimpor fasilitas sekitar tiap destinasi dari OSM (Overpass)
// ke supabase/seed/facilities.json. Sesuai Rancangan Teknis: Overpass hanya
// dipanggil oleh skrip impor ini (20 permintaan), TIDAK PERNAH saat runtime.
//
// Data © OpenStreetMap contributors, lisensi ODbL (https://www.openstreetmap.org/copyright).
//
// Jalankan: docker compose exec app npm run seed:facilities

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { overpass, pointOf, sleep, type OverpassElement } from "./lib/overpass";

type SeedDestination = { slug: string; lat: number; lon: number };
type FacilityType = "toilet" | "parkir" | "makan" | "ibadah" | "atm" | "halte" | "stasiun";
export type SeedFacility = {
  osmType: string;
  osmId: number;
  type: FacilityType;
  name: string | null;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

const SEED_DIR = path.resolve(process.cwd(), "supabase/seed");
const PROGRESS_FILE = "/tmp/jl-facilities-progress.json";
const GAP_MS = 4000;

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

// Query dari Rancangan Teknis: radius 1,5 km untuk fasilitas dan halte, 5 km untuk stasiun.
const queryFor = ({ lat, lon }: SeedDestination) => `[out:json][timeout:60];
(
  nwr(around:1500,${lat},${lon})[amenity~"^(toilets|parking|restaurant|cafe|fast_food|atm|place_of_worship)$"];
  nwr(around:1500,${lat},${lon})[highway=bus_stop];
  nwr(around:5000,${lat},${lon})[railway=station];
);
out center tags;`;

function toFacility(element: OverpassElement): SeedFacility | null {
  const tags = element.tags ?? {};
  const type = classify(tags);
  const point = pointOf(element);
  if (!type || !point) return null;
  return {
    osmType: element.type,
    osmId: element.id,
    type,
    name: tags.name?.trim() || null,
    lat: Number(point.lat.toFixed(7)),
    lon: Number(point.lon.toFixed(7)),
    tags,
  };
}

async function main() {
  const destinations = JSON.parse(
    await readFile(path.join(SEED_DIR, "destinations.json"), "utf8"),
  ) as SeedDestination[];

  const progress: Record<string, SeedFacility[]> = existsSync(PROGRESS_FILE)
    ? JSON.parse(await readFile(PROGRESS_FILE, "utf8"))
    : {};

  for (const destination of destinations) {
    if (progress[destination.slug]) {
      console.log(`[${destination.slug}] sudah ada di progres, dilewati`);
      continue;
    }
    console.log(`[${destination.slug}] mengambil fasilitas...`);
    const elements = await overpass(queryFor(destination));
    progress[destination.slug] = elements.map(toFacility).filter((item): item is SeedFacility => item !== null);
    await writeFile(PROGRESS_FILE, JSON.stringify(progress));
    console.log(`[${destination.slug}] ${progress[destination.slug].length} fasilitas`);
    await sleep(GAP_MS);
  }

  // Gabungkan lintas destinasi; satu objek OSM bisa dekat beberapa destinasi.
  const unique = new Map<string, SeedFacility>();
  for (const list of Object.values(progress)) {
    for (const facility of list) unique.set(`${facility.osmType}/${facility.osmId}`, facility);
  }
  const all = [...unique.values()].sort((a, b) => a.osmType.localeCompare(b.osmType) || a.osmId - b.osmId);

  await writeFile(path.join(SEED_DIR, "facilities.json"), `${JSON.stringify(all)}\n`);

  const perType = new Map<string, number>();
  for (const facility of all) perType.set(facility.type, (perType.get(facility.type) ?? 0) + 1);
  console.log(`\nSelesai: ${all.length} fasilitas unik ditulis ke supabase/seed/facilities.json`);
  console.log([...perType.entries()].map(([type, n]) => `${type}=${n}`).join(", "));
  console.log("\nPer destinasi (fasilitas dalam daftarnya, sebelum dedup):");
  for (const [slug, list] of Object.entries(progress)) {
    const counts = new Map<string, number>();
    for (const f of list) counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
    console.log(`  ${slug.padEnd(32)} ${String(list.length).padStart(4)}  ${[...counts.entries()].map(([t, n]) => `${t}:${n}`).join(" ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
