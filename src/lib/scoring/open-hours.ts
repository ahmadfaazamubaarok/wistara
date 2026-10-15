// Jam buka destinasi. Format di DB (destinations.open_hours, jsonb):
//   {"mon":["08:00","16:00"], "tue":[...], ...}
// Hari tanpa kunci = tutup. NULL = tidak ada batas jam, lalu dipakai jendela
// kunjungan bawaan (DEFAULT_VISIT_WINDOW) agar tidak menyarankan pantai pukul 03.00.
//
// ATURAN SLOT: sebuah slot 3 jam dianggap BUKA bila JAM MULAI-nya berada di
// dalam jam buka, yaitu buka <= mulai < tutup. Slot 06.00 untuk tempat yang
// baru buka 08.30 dianggap tutup, walau beririsan 30 menit.

import { z } from "zod";

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

const timeText = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/);
export const openHoursSchema = z.partialRecord(
  z.enum(DAY_KEYS),
  z.tuple([timeText, timeText]).refine(([open, close]) => open < close, "jam tutup harus setelah jam buka"),
);
export type OpenHours = z.infer<typeof openHoursSchema>;

/** Jendela kunjungan untuk destinasi tanpa jam buka tetap (ASUMSI DESAIN tim). */
export const DEFAULT_VISIT_WINDOW: [string, string] = ["06:00", "18:00"];

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Baca nilai jsonb dari DB. Nilai rusak dianggap NULL (jendela bawaan) dan dicatat. */
export function parseOpenHours(value: unknown): OpenHours | null {
  if (value === null || value === undefined) return null;
  const parsed = openHoursSchema.safeParse(value);
  if (!parsed.success) {
    console.warn("[open-hours] format open_hours tidak valid, memakai jendela bawaan:", parsed.error.issues[0]?.message);
    return null;
  }
  return parsed.data;
}

/**
 * @param localTime waktu lokal WIB tanpa zona, mis. "2026-10-16T15:00:00"
 */
export function isOpenAtLocalTime(openHours: OpenHours | null, localTime: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(localTime);
  if (!match) throw new RangeError(`Waktu lokal tidak valid: "${localTime}"`);

  const [, y, mo, d, hh, mm] = match;
  // Kalender saja yang dibutuhkan; Date.UTC menghindari pergeseran zona mesin.
  const weekday = DAY_KEYS[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()];
  const start = Number(hh) * 60 + Number(mm);

  const window = openHours === null ? DEFAULT_VISIT_WINDOW : openHours[weekday];
  if (!window) return false;
  return toMinutes(window[0]) <= start && start < toMinutes(window[1]);
}
