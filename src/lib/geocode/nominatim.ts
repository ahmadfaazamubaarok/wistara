// Saran kabupaten/kota dan alamat dari koordinat (reverse geocoding) untuk formulir usulan.
// Sumber: OpenStreetMap lewat Nominatim. Dipanggil HANYA dari server, jadi browser tidak
// menghubungi pihak ketiga dan CSP tidak berubah. Hasilnya hanya SARAN: pengguna selalu bisa
// mengubahnya, dan bila layanan gagal formulir tetap bisa diisi manual.
//
// Kebijakan pemakaian Nominatim publik (maksimal 1 permintaan per detik, User-Agent yang
// mengidentifikasi aplikasi): https://operations.osmfoundation.org/policies/nominatim/
// Untuk beban besar, arahkan GEOCODER_BASE_URL ke instance sendiri atau layanan berbayar.
// Data © OpenStreetMap contributors (ODbL).

import { z } from "zod";
import type { KabupatenDiy } from "../submissions/constants";

export const NOMINATIM_USER_AGENT = "Wistara/1.0 (+https://github.com/alelkohan/wistara)";
export const DEFAULT_GEOCODER_URL = "https://nominatim.openstreetmap.org";

export type PlaceHints = { kabupaten: KabupatenDiy | null; address: string | null };
const EMPTY: PlaceHints = { kabupaten: null, address: null };

/** Nama kabupaten/kota ditulis beragam ("Kulonprogo", "Kabupaten Sleman", "Kota Yogyakarta"); samakan dulu. */
const squash = (value: string | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/\b(kabupaten|kab\.?|kota)\b/g, "")
    .replace(/[^a-z]/g, "");

const KABUPATEN_BY_KEY: Record<string, KabupatenDiy> = {
  yogyakarta: "Kota Yogyakarta",
  sleman: "Sleman",
  bantul: "Bantul",
  kulonprogo: "Kulon Progo",
  gunungkidul: "Gunungkidul",
};

type Address = Record<string, string>;

/** `state` sengaja tidak dipakai: "Daerah Istimewa Yogyakarta" bukan Kota Yogyakarta. */
function matchKabupaten(address: Address): KabupatenDiy | null {
  for (const field of ["county", "city", "regency", "state_district"]) {
    const match = KABUPATEN_BY_KEY[squash(address[field])];
    if (match) return match;
  }
  return null;
}

const first = (...values: (string | undefined)[]) => values.map((value) => value?.trim()).find((value): value is string => !!value);

/** "Jalan, Desa/Kel., Kec." sesuai petunjuk formulir. Bagian yang tidak diketahui dilewati. */
function composeAddress(address: Address): string | null {
  const street = first(address.road, address.hamlet, address.neighbourhood, address.quarter);
  const village = address.village ? `Desa ${address.village}` : address.suburb ? `Kel. ${address.suburb}` : undefined;
  const kecamatan = first(address.municipality, address.town, address.city_district, address.district);
  const parts = [street, village, kecamatan ? `Kec. ${kecamatan}` : undefined].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(", ") : null;
}

const responseSchema = z.object({ address: z.record(z.string(), z.unknown()).optional() }).loose();

/** Respons Nominatim -> saran. Bentuk yang tidak dikenal, galat, atau titik di luar DIY menghasilkan saran kosong. */
export function parsePlaceHints(body: unknown): PlaceHints {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success || !parsed.data.address) return EMPTY;

  const address: Address = {};
  for (const [key, value] of Object.entries(parsed.data.address)) {
    if (typeof value === "string") address[key] = value;
  }

  const inDiy = address["ISO3166-2-lvl4"] === "ID-YO" || /yogyakarta/i.test(address.state ?? "");
  if (!inDiy) return EMPTY;
  return { kabupaten: matchKabupaten(address), address: composeAddress(address) };
}

export type ReverseOptions = { baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch };

/** @throws bila layanan tidak terjangkau, lambat, atau membalas non-2xx. */
export async function reverseGeocode(lat: number, lon: number, options: ReverseOptions = {}): Promise<PlaceHints> {
  const base = (options.baseUrl || process.env.GEOCODER_BASE_URL || DEFAULT_GEOCODER_URL).replace(/\/+$/, "");
  const url = `${base}/reverse?format=jsonv2&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&zoom=18&addressdetails=1&accept-language=id`;
  const response = await (options.fetchImpl ?? fetch)(url, {
    headers: { "User-Agent": NOMINATIM_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(options.timeoutMs ?? 4000),
  });
  if (!response.ok) throw new Error(`Geokode membalas HTTP ${response.status}`);
  return parsePlaceHints(await response.json());
}
