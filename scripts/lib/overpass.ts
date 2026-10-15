// Klien Overpass untuk SKRIP IMPOR saja. Aplikasi tidak pernah memanggil
// Overpass saat runtime (instance publik bukan untuk backend aplikasi).
//
// Instance publik kadang kelebihan beban (HTTP 429/502/504), jadi permintaan
// yang gagal dicoba ulang ke server cermin berikutnya.

// Urutan mengikuti keandalan yang teramati pada 15 Okt 2026: instance OSM Prancis
// menjawab konsisten, overpass-api.de sering gagal TLS/502, mirror lain putus-putus.
const DEFAULT_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
// OVERPASS_URL boleh berisi beberapa alamat, dipisah koma.
const ENDPOINTS = (process.env.OVERPASS_URL?.split(",").map((s) => s.trim()).filter(Boolean) ?? []).length
  ? process.env.OVERPASS_URL!.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ENDPOINTS;

const USER_AGENT = "JelajahLokal-import/0.1 (proyek mahasiswa UINIC 8.0; impor sekali)";
const MAX_ATTEMPTS = 6;

export type OverpassElement = {
  type: "node" | "way" | "relation" | "area";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function overpass(query: string): Promise<OverpassElement[]> {
  const errors: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const endpoint = ENDPOINTS[(attempt - 1) % ENDPOINTS.length];
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(75_000),
      });
      if (response.ok) {
        const body = (await response.json()) as { elements?: OverpassElement[]; remark?: string };
        // Overpass membalas 200 dengan "remark" saat query kehabisan waktu/memori.
        if (body.remark && /error|timed out|out of memory/i.test(body.remark)) {
          errors.push(`${new URL(endpoint).host}: ${body.remark.slice(0, 80)}`);
        } else {
          return body.elements ?? [];
        }
      } else {
        errors.push(`${new URL(endpoint).host}: HTTP ${response.status}`);
        if (response.status !== 429 && response.status < 500) break;
      }
    } catch (error) {
      errors.push(`${new URL(endpoint).host}: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(2500 * attempt);
  }
  throw new Error(`Overpass gagal (${errors.join("; ")})`);
}

/** Titik representatif elemen: node apa adanya, way/relation memakai center. */
export function pointOf(element: OverpassElement): { lat: number; lon: number } | null {
  if (element.lat !== undefined && element.lon !== undefined) return { lat: element.lat, lon: element.lon };
  if (element.center) return element.center;
  return null;
}
