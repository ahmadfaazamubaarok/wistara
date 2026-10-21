"use server";

import { z } from "zod";
import { allowGeocode } from "@/lib/api/rate-limit";
import { getPageUser } from "@/lib/auth/session";
import { reverseGeocode, type PlaceHints } from "@/lib/geocode/nominatim";
import { isInsideDiy } from "@/lib/geo/diy-boundary";
import type { KabupatenDiy } from "@/lib/submissions/constants";

export type GeocodeResult = { ok: true; kabupaten: KabupatenDiy | null; address: string | null } | { ok: false };

const input = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

// Cache kecil per instance: pengguna sering mengklik titik yang sama atau berdekatan. Kunci dibulatkan
// ke 4 desimal (±11 m). Aman bila hilang (serverless), hanya menghemat panggilan.
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 300;
const cache = new Map<string, { at: number; hints: PlaceHints }>();

/**
 * Saran kabupaten/kota dan alamat untuk titik di peta. Hanya untuk pengguna yang login (formulir usulan
 * juga butuh login) dan hanya untuk titik di DIY. Gagal secara halus: `{ ok: false }` berarti isi manual.
 */
export async function reverseGeocodeAction(lat: number, lon: number): Promise<GeocodeResult> {
  const parsed = input.safeParse({ lat, lon });
  if (!parsed.success) return { ok: false };

  const user = await getPageUser();
  if (!user) return { ok: false };

  // Di luar DIY tidak ada gunanya mencari alamat; validasi batasnya tetap dilakukan saat mengirim.
  if (!isInsideDiy(parsed.data.lat, parsed.data.lon)) return { ok: true, kabupaten: null, address: null };

  const key = `${parsed.data.lat.toFixed(4)},${parsed.data.lon.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return { ok: true, ...cached.hints };

  try {
    if (!(await allowGeocode(user.id))) return { ok: false };
    const hints = await reverseGeocode(parsed.data.lat, parsed.data.lon);
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), hints });
    return { ok: true, ...hints };
  } catch (error) {
    console.warn("[geocode] gagal:", error instanceof Error ? error.message : error);
    return { ok: false };
  }
}
