// Skrip sekali jalan untuk memetakan destinasi pantai ke kode perairan BMKG (P.N.01, P.N.02, P.N.03)
// berdasarkan jarak terdekat ke poligon wilmetos.min.geojson.
//
// Aturan:
// - Jarak ke poligon terdekat < 5 km dan selisih dengan poligon kedua terdekat > 1 km.
// - Selain itu isi null.
// - Menulis hasil ke supabase/seed/destinations.json.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const GEOJSON_URL = "https://maritim.bmkg.go.id/marine2026-data/meta/wilmetos.min.geojson";
const TARGET_CODES = ["P.N.01", "P.N.02", "P.N.03"] as const;

type Point = [number, number]; // [lon, lat]

function haversineDistanceMeters(p1: Point, p2: Point): number {
  const [lon1, lat1] = p1;
  const [lon2, lat2] = p2;
  const R = 6371000; // Radius bumi dalam meter
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Jarak minimum titik ke segmen garis [a, b] di permukaan bumi
function pointToSegmentDistanceMeters(p: Point, a: Point, b: Point): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;

  // Proyeksi planar lokal derajat ke meter
  const midLat = ((ay + by + py) / 3) * (Math.PI / 180);
  const cosMid = Math.cos(midLat);
  const mPerDegLat = 111132;
  const mPerDegLon = 111320 * cosMid;

  const dxAB = (bx - ax) * mPerDegLon;
  const dyAB = (by - ay) * mPerDegLat;
  const lenSq = dxAB * dxAB + dyAB * dyAB;

  if (lenSq === 0) return haversineDistanceMeters(p, a);

  const dxAP = (px - ax) * mPerDegLon;
  const dyAP = (py - ay) * mPerDegLat;

  const t = Math.max(0, Math.min(1, (dxAP * dxAB + dyAP * dyAB) / lenSq));
  const projPoint: Point = [ax + (t * (bx - ax)), ay + (t * (by - ay))];

  return haversineDistanceMeters(p, projPoint);
}

// Jarak minimum dari titik pantai ke tepi poligon
function pointToPolygonDistanceMeters(p: Point, coordinates: Point[][]): number {
  let minDistance = Infinity;
  for (const ring of coordinates) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      const dist = pointToSegmentDistanceMeters(p, ring[i], ring[i + 1]);
      if (dist < minDistance) minDistance = dist;
    }
  }
  return minDistance;
}

export async function runAssignMarineAreas(): Promise<void> {
  console.log("Mengunduh metadata poligon maritim BMKG...");
  let geojsonRaw: unknown;
  try {
    const res = await fetch(GEOJSON_URL, {
      headers: { "User-Agent": "Wistara/0.1 (assign-marine-areas)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    geojsonRaw = await res.json();
  } catch (error) {
    console.error("Gagal mengunduh wilmetos.min.geojson dari BMKG:", error);
    throw new Error("Jaringan tidak tersedia untuk mengunduh wilmetos.min.geojson. Skrip dihentikan.");
  }

  type DestSeed = {
    slug: string;
    name: string;
    category: string;
    lat: number;
    lon: number;
    marineAreaCode?: string | null;
    [key: string]: unknown;
  };

  const geojson = geojsonRaw as {
    features: Array<{
      properties: { ID_MAR?: string };
      geometry: { type: string; coordinates: unknown };
    }>;
  };

  const polygons = new Map<string, Point[][]>();
  for (const feature of geojson.features) {
    const code = feature.properties?.ID_MAR;
    if (code && (TARGET_CODES as readonly string[]).includes(code)) {
      if (feature.geometry.type === "Polygon") {
        polygons.set(code, feature.geometry.coordinates as Point[][]);
      } else if (feature.geometry.type === "MultiPolygon") {
        polygons.set(code, (feature.geometry.coordinates as Point[][][]).flat());
      }
    }
  }

  for (const code of TARGET_CODES) {
    if (!polygons.has(code)) {
      throw new Error(`Poligon maritim untuk kode ${code} tidak ditemukan di geojson BMKG!`);
    }
  }

  const destPath = path.resolve(process.cwd(), "supabase/seed/destinations.json");
  const destinations: DestSeed[] = JSON.parse(await readFile(destPath, "utf8"));

  const results: Array<{
    slug: string;
    name: string;
    chosenCode: string | null;
    dist1Km: number;
    dist2Km: number;
    diffKm: number;
  }> = [];

  for (const dest of destinations) {
    if (dest.category !== "pantai") {
      delete dest.marineAreaCode;
      continue;
    }

    const p: Point = [dest.lon, dest.lat];
    const distances: Array<{ code: string; distanceMeters: number }> = [];

    for (const [code, rings] of polygons.entries()) {
      const d = pointToPolygonDistanceMeters(p, rings);
      distances.push({ code, distanceMeters: d });
    }

    distances.sort((a, b) => a.distanceMeters - b.distanceMeters);
    const first = distances[0];
    const second = distances[1];

    const dist1Km = Math.round((first.distanceMeters / 1000) * 100) / 100;
    const dist2Km = Math.round((second.distanceMeters / 1000) * 100) / 100;
    const diffKm = Math.round(((second.distanceMeters - first.distanceMeters) / 1000) * 100) / 100;

    // Aturan: jarak < 5 km dan selisih dengan kandidat kedua > 1 km
    let chosenCode: string | null = null;
    if (first.distanceMeters < 5000 && second.distanceMeters - first.distanceMeters > 1000) {
      chosenCode = first.code;
    }

    dest.marineAreaCode = chosenCode;

    results.push({
      slug: dest.slug,
      name: dest.name,
      chosenCode,
      dist1Km,
      dist2Km,
      diffKm,
    });
  }

  // Koreksi manual yang sudah ditinjau tim. Diterapkan SETELAH perhitungan jarak
  // agar tidak hilang saat skrip dijalankan ulang.
  const overridesPath = path.resolve(process.cwd(), "supabase/seed/marine-area-overrides.json");
  const overrides: Array<{ slug: string; marineAreaCode: string | null; reason: string }> = JSON.parse(
    await readFile(overridesPath, "utf8"),
  );
  for (const override of overrides) {
    const dest = destinations.find((d) => d.slug === override.slug);
    if (!dest || dest.category !== "pantai") {
      throw new Error(`Override untuk "${override.slug}" tidak cocok dengan destinasi pantai mana pun`);
    }
    if (override.marineAreaCode !== null && !(TARGET_CODES as readonly string[]).includes(override.marineAreaCode)) {
      throw new Error(`Override "${override.slug}" memakai kode tidak dikenal ${override.marineAreaCode}`);
    }
    dest.marineAreaCode = override.marineAreaCode;
    const row = results.find((r) => r.slug === override.slug);
    if (row) row.chosenCode = override.marineAreaCode;
    console.log(`[override] ${override.slug} -> ${override.marineAreaCode ?? "null"} (${override.reason})`);
  }

  console.table(results);
  await writeFile(destPath, JSON.stringify(destinations, null, 2) + "\n", "utf8");
  console.log(`Berhasil memperbarui ${destPath} untuk ${results.length} destinasi pantai.`);
}

// Jalankan bila dieksekusi langsung
if (process.argv[1]?.includes("assign-marine-areas")) {
  runAssignMarineAreas().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
