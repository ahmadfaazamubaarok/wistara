// Batas wilayah DI Yogyakarta untuk memastikan lokasi usulan berada di DIY. Poligon yang sama
// dipakai skrip penyaring destinasi (scripts/import-all-diy-destinations.ts).

import boundaryJson from "../../../supabase/seed/diy-boundary.json";

type Ring = number[][]; // [lon, lat]
type Boundary = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

const boundary = boundaryJson as Boundary;

/** Ray casting: ganjil-genap jumlah sisi yang dilintasi sinar ke arah timur. */
function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Hanya cincin luar yang dipakai; batas DIY tidak punya lubang. */
export function isInsideDiy(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (boundary.type === "Polygon") return pointInRing(lon, lat, boundary.coordinates[0]);
  return boundary.coordinates.some((polygon) => pointInRing(lon, lat, polygon[0]));
}
