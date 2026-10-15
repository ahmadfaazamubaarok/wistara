// Merakit slot berskor dari baris prakiraan + profil bobot + jam buka.

import { getScoreBand, SCORE_LABEL, type ScoreBand } from "../score-band";
import { getWibDateKey } from "../wib";
import { isOpenAtLocalTime, type OpenHours } from "../scoring/open-hours";
import { scoreWeather, type PenaltyKey, type ScoreHooks, type ScoreProfile } from "../scoring/score";

export const SLOT_HOURS = 3;
const SLOT_MS = SLOT_HOURS * 60 * 60 * 1000;

/** Baris prakiraan seperti di tabel `forecasts` (camelCase). */
export type ForecastRow = {
  validAt: Date;
  /** WIB tanpa zona, "2026-10-16T15:00:00". */
  localTime: string;
  t: number | null;
  hu: number | null;
  ws: number | null;
  wd: string | null;
  tcc: number | null;
  weatherDesc: string | null;
};

export type ScoredSlot = {
  /** Awal slot dalam UTC, ISO 8601. */
  validAt: string;
  /** Awal slot dalam WIB, "2026-10-16T15:00:00+07:00" (format contoh API). */
  localTime: string;
  weatherDesc: string | null;
  t: number | null;
  ws: number | null;
  hu: number | null;
  wd: string | null;
  tcc: number | null;
  isOpen: boolean;
  /** null bila slot tutup (tidak dinilai). */
  score: number | null;
  band: ScoreBand;
  label: string;
  reasons: string[];
  dominant: PenaltyKey | null;
};

export function scoreSlots(
  rows: ForecastRow[],
  destination: { openHours: OpenHours | null },
  profile: ScoreProfile,
  hooks?: ScoreHooks,
): ScoredSlot[] {
  return rows.map((row) => {
    const common = {
      validAt: row.validAt.toISOString(),
      localTime: `${row.localTime}+07:00`,
      weatherDesc: row.weatherDesc,
      t: row.t,
      ws: row.ws,
      hu: row.hu,
      wd: row.wd,
      tcc: row.tcc,
    };

    if (!isOpenAtLocalTime(destination.openHours, row.localTime)) {
      return {
        ...common,
        isOpen: false,
        score: null,
        band: getScoreBand(null),
        label: SCORE_LABEL.closed,
        reasons: [],
        dominant: null,
      };
    }

    const result = scoreWeather({ weatherDesc: row.weatherDesc, t: row.t, ws: row.ws }, profile, hooks);
    return {
      ...common,
      isOpen: true,
      score: result.score,
      band: result.band,
      label: result.label,
      reasons: result.reasons,
      dominant: result.dominant,
    };
  });
}

/** Irisan waktu minimum (ms) agar dua slot dianggap "slot yang sama": setengah slot. */
export const MIN_OVERLAP_MS = SLOT_MS / 2;

/**
 * Slot milik wilayah lain yang paling tumpang-tindih dengan slot mulai `startMs`.
 *
 * Grid 3 jam BMKG TIDAK sejajar antar-wilayah: sebagian desa berjam 00, 03, 06, ...
 * dan sebagian lain 01, 04, 07, ... (teramati pada data nyata). Mencocokkan
 * slot dengan waktu mulai yang persis sama akan diam-diam gagal antar-wilayah
 * berbeda fase, jadi dipakai slot dengan irisan terbesar (minimal setengah slot).
 */
export function bestOverlappingSlot<T extends { validAt: string }>(candidates: T[], startMs: number): T | undefined {
  const endMs = startMs + SLOT_MS;
  let best: T | undefined;
  let bestOverlap = 0;
  for (const candidate of candidates) {
    const candidateStart = new Date(candidate.validAt).getTime();
    const overlap = Math.min(endMs, candidateStart + SLOT_MS) - Math.max(startMs, candidateStart);
    if (overlap > bestOverlap) {
      best = candidate;
      bestOverlap = overlap;
    }
  }
  return bestOverlap >= MIN_OVERLAP_MS ? best : undefined;
}

/** Buang slot yang sudah berakhir. Slot 15.00 masih tampil pada pukul 16.30. */
export function upcomingSlots<T extends { validAt: string }>(slots: T[], now: Date): T[] {
  return slots.filter((slot) => new Date(slot.validAt).getTime() + SLOT_MS > now.getTime());
}

/** Tanggal WIB (YYYY-MM-DD) untuk hari ini, besok, dan lusa. */
export function wibDayKeys(now: Date, days = 3): string[] {
  const start = new Date(now.getTime());
  return Array.from({ length: days }, (_, i) => getWibDateKey(new Date(start.getTime() + i * 24 * 60 * 60 * 1000)));
}

export const slotDateKey = (slot: { localTime: string }) => slot.localTime.slice(0, 10);

/** Slot buka berskor tertinggi untuk tiap tanggal (seri: yang paling awal). */
export function bestSlotPerDay(slots: ScoredSlot[]): Map<string, ScoredSlot> {
  const best = new Map<string, ScoredSlot>();
  for (const slot of slots) {
    if (slot.score === null) continue;
    const key = slotDateKey(slot);
    const current = best.get(key);
    if (!current || slot.score > (current.score as number)) best.set(key, slot);
  }
  return best;
}
