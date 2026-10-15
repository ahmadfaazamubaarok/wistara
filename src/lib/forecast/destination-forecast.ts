// Merakit prakiraan berskor untuk satu atau banyak destinasi dari layanan cuaca.

import type { DestCategory } from "../categories";
import { getScoreProfiles, type Destination } from "../db/destinations";
import type { ScoreProfile } from "../scoring/score";
import { getRegionForecast, type RegionForecast } from "../weather/service";
import {
  bestSlotPerDay,
  scoreSlots,
  upcomingSlots,
  wibDayKeys,
  type ScoredSlot,
} from "./slots";

export type SourceInfo = {
  provider: "BMKG";
  analysisDate: string | null;
  fetchedAt: string | null;
  isStale: boolean;
};

export type BestOfDay = {
  date: string;
  localTime: string;
  score: number;
  label: ScoredSlot["label"];
  band: ScoredSlot["band"];
};

export type DestinationForecast = {
  slots: ScoredSlot[];
  source: SourceInfo;
  /** Tanggal WIB yang diminta (hari ini, besok, lusa). */
  dayKeys: string[];
  /** Selaras dengan dayKeys; null bila hari itu tidak punya slot buka. */
  bestByDay: (BestOfDay | null)[];
};

type Profiles = Record<DestCategory, ScoreProfile>;

const warnedWeather = new Set<string>();
/** Teks cuaca BMKG di luar tabel penalti: dicatat sekali per proses, penalti 0. */
export function warnUnknownWeather(description: string) {
  if (warnedWeather.has(description)) return;
  warnedWeather.add(description);
  console.warn(`[weather] teks cuaca BMKG tidak dikenal, penalti 0: "${description}"`);
}

export function sourceOf(region: RegionForecast): SourceInfo {
  return {
    provider: "BMKG",
    analysisDate: region.analysisDate?.toISOString() ?? null,
    fetchedAt: region.fetchedAt?.toISOString() ?? null,
    isStale: region.isStale,
  };
}

function toBest(date: string, slot: ScoredSlot | undefined): BestOfDay | null {
  if (!slot || slot.score === null) return null;
  return { date, localTime: slot.localTime, score: slot.score, label: slot.label, band: slot.band };
}

export function buildDestinationForecast(
  destination: Destination,
  region: RegionForecast,
  profiles: Profiles,
  now: Date,
  days = 3,
): DestinationForecast {
  const profile = profiles[destination.category];
  if (!profile) throw new Error(`Profil bobot untuk kategori "${destination.category}" tidak ada di score_profiles`);

  const dayKeys = wibDayKeys(now, days);
  const scored = scoreSlots(region.rows, destination, profile, { onUnknownWeather: warnUnknownWeather });
  const slots = upcomingSlots(scored, now).filter((slot) => dayKeys.includes(slot.localTime.slice(0, 10)));
  const best = bestSlotPerDay(slots);

  return {
    slots,
    source: sourceOf(region),
    dayKeys,
    bestByDay: dayKeys.map((day) => toBest(day, best.get(day))),
  };
}

export async function getDestinationForecast(
  destination: Destination,
  options: { days?: number; now?: Date; profiles?: Profiles } = {},
): Promise<DestinationForecast> {
  const now = options.now ?? new Date();
  const [profiles, region] = await Promise.all([
    options.profiles ?? getScoreProfiles(),
    getRegionForecast(destination.adm4Code, { now }),
  ]);
  return buildDestinationForecast(destination, region, profiles, now, options.days);
}

/**
 * Prakiraan banyak destinasi sekaligus (untuk peta Beranda). Satu wilayah hanya
 * dibaca sekali walau dipakai beberapa destinasi.
 */
export async function getManyForecasts(
  destinations: Destination[],
  options: { days?: number; now?: Date } = {},
): Promise<{ bySlug: Map<string, DestinationForecast>; source: SourceInfo | null; dayKeys: string[] }> {
  const now = options.now ?? new Date();
  const days = options.days ?? 3;
  const profiles = await getScoreProfiles();

  const codes = [...new Set(destinations.map((d) => d.adm4Code))];
  const regions = new Map<string, RegionForecast>();
  await Promise.all(codes.map(async (code) => regions.set(code, await getRegionForecast(code, { now }))));

  const bySlug = new Map<string, DestinationForecast>();
  for (const destination of destinations) {
    bySlug.set(
      destination.slug,
      buildDestinationForecast(destination, regions.get(destination.adm4Code)!, profiles, now, days),
    );
  }

  // Ringkasan sumber: data tertua yang menentukan label "data lama".
  const all = [...regions.values()];
  let source: SourceInfo | null = null;
  if (all.length > 0) {
    const times = (pick: (r: RegionForecast) => Date | null) =>
      all.map(pick).filter((d): d is Date => d !== null).map((d) => d.getTime());
    const fetched = times((r) => r.fetchedAt);
    const analysed = times((r) => r.analysisDate);
    source = {
      provider: "BMKG",
      analysisDate: analysed.length ? new Date(Math.max(...analysed)).toISOString() : null,
      fetchedAt: fetched.length === all.length ? new Date(Math.min(...fetched)).toISOString() : null,
      isStale: all.some((r) => r.isStale),
    };
  }

  return { bySlug, source, dayKeys: wibDayKeys(now, days) };
}
