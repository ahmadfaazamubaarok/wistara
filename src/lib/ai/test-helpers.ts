// Data uji bersama untuk tes asisten (bukan kode produksi).

import type { DestCategory } from "../categories";
import type { ScoredSlot } from "../forecast/slots";
import { getDestinationAttribute } from "./attributes";
import type { EngineDestination } from "./engine";
import type { CatalogEntry } from "./resolver";

export const CATALOG: (CatalogEntry & { category: DestCategory; indoor?: boolean })[] = [
  { slug: "pantai-parangtritis", name: "Pantai Parangtritis", category: "pantai" },
  { slug: "pantai-indrayanti", name: "Pantai Indrayanti", category: "pantai" },
  { slug: "pantai-baron", name: "Pantai Baron", category: "pantai" },
  { slug: "pantai-glagah", name: "Pantai Glagah", category: "pantai" },
  { slug: "gumuk-pasir-parangkusumo", name: "Gumuk Pasir Parangkusumo", category: "alam" },
  { slug: "gunung-api-purba-nglanggeran", name: "Gunung Api Purba Nglanggeran", category: "alam" },
  { slug: "hutan-pinus-mangunan", name: "Hutan Pinus Mangunan", category: "alam" },
  { slug: "kalibiru", name: "Kalibiru", category: "alam" },
  { slug: "keraton-yogyakarta", name: "Keraton Yogyakarta", category: "budaya" },
  { slug: "taman-sari", name: "Taman Sari", category: "budaya" },
  { slug: "candi-prambanan", name: "Candi Prambanan", category: "budaya" },
  { slug: "candi-ratu-boko", name: "Candi Ratu Boko", category: "budaya" },
  { slug: "museum-benteng-vredeburg", name: "Museum Benteng Vredeburg", category: "museum", indoor: true },
  { slug: "museum-sonobudoyo", name: "Museum Sonobudoyo", category: "museum", indoor: true },
  { slug: "museum-affandi", name: "Museum Affandi", category: "museum", indoor: true },
  { slug: "museum-ullen-sentalu", name: "Museum Ullen Sentalu", category: "museum", indoor: true },
  { slug: "desa-wisata-pentingsari", name: "Desa Wisata Pentingsari", category: "desa_wisata" },
  { slug: "desa-wisata-brayut", name: "Desa Wisata Brayut", category: "desa_wisata" },
  { slug: "desa-wisata-kasongan", name: "Desa Wisata Kasongan", category: "desa_wisata" },
  { slug: "desa-wisata-tembi", name: "Desa Wisata Tembi", category: "desa_wisata" },
];

export const CATALOG_ENTRIES: CatalogEntry[] = CATALOG.map(({ slug, name }) => ({ slug, name }));

/** Sabtu 17 Okt 2026, 03.07 WIB. */
export const NOW = new Date("2026-10-16T20:07:00Z");
export const TODAY = "2026-10-17";
export const TOMORROW = "2026-10-18";

export function makeSlot(dayKey: string, hour: number, score: number | null, overrides: Partial<ScoredSlot> = {}): ScoredSlot {
  const hh = String(hour).padStart(2, "0");
  const open = score !== null;
  return {
    validAt: new Date(`${dayKey}T${hh}:00:00+07:00`).toISOString(),
    localTime: `${dayKey}T${hh}:00:00+07:00`,
    weatherDesc: "Cerah",
    t: 28,
    ws: 10,
    hu: 70,
    wd: "S",
    tcc: 20,
    isOpen: open,
    score,
    band: open ? (score >= 75 ? "good" : score >= 50 ? "mid" : "bad") : "closed",
    label: open ? (score >= 75 ? "Sangat sesuai" : "Cukup sesuai") : "Tutup",
    reasons: [],
    dominant: null,
    ...overrides,
  };
}

/** Slot 06, 09, 12, 15 pada satu hari dengan skor yang sama (kecuali diberi daftar skor). */
export function daySlots(dayKey: string, scores: (number | null)[] = [80, 80, 80, 80], hours = [6, 9, 12, 15]): ScoredSlot[] {
  return hours.map((hour, i) => makeSlot(dayKey, hour, scores[i] ?? null));
}

export function makeDest(slug: string, overrides: Partial<EngineDestination> = {}): EngineDestination {
  const entry = CATALOG.find((c) => c.slug === slug);
  if (!entry) throw new Error(`slug tidak dikenal: ${slug}`);
  const isIndoor = Boolean(entry.indoor);
  return {
    id: `id-${slug}`,
    slug,
    name: entry.name,
    category: entry.category,
    isIndoor,
    adm4Code: "34.01.01.2001",
    lat: -7.8,
    lon: 110.4,
    openHours: null,
    description: null,
    osmRef: null,
    verifiedAt: null,
    region: { desa: "Desa", kecamatan: "Kecamatan", kabupaten: "Bantul" },
    marineAreaCode: overrides.marineAreaCode ?? null,
    slots: [...daySlots(TODAY), ...daySlots(TOMORROW)],
    enrichment: undefined,
    attr: getDestinationAttribute(slug, isIndoor),
    alert: null,
    ...overrides,
  };
}
