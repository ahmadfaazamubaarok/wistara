// Pemahaman waktu dari kalimat pengguna ("besok siang jam 13.00", "hari Minggu", "weekend") dan
// pemilihan slot prakiraan yang sesuai. Murni dan teruji; tidak bergantung pada model.

import { SLOT_HOURS, type ScoredSlot } from "../forecast/slots";
import { formatWibTime, getWibDateKey } from "../wib";
import { normalize } from "./text";

export type Part = "pagi" | "siang" | "sore" | "malam";

export type ParsedWhen = {
  /** 0 = hari ini, 1 = besok, 2 = lusa; null = tidak disebut. */
  dayOffset: number | null;
  /** Jam WIB 0-23 bila disebut jelas. */
  hour: number | null;
  part: Part | null;
  /** Waktu di luar jangkauan prakiraan 3 hari (atau sudah lewat), mis. "hari Jumat (6 hari lagi)". */
  beyond: string | null;
  isNow: boolean;
};

export const EMPTY_WHEN: ParsedWhen = { dayOffset: null, hour: null, part: null, beyond: null, isNow: false };

/** Rentang jam lokal [mulai, selesai) untuk tiap bagian hari. */
export const PART_RANGE: Record<Part, [number, number]> = {
  pagi: [5, 11],
  siang: [11, 15],
  sore: [15, 18],
  malam: [18, 24],
};

const PART_LABEL: Record<Part, string> = { pagi: "pagi", siang: "siang", sore: "sore", malam: "malam" };
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const SLOT_MS = SLOT_HOURS * 60 * 60 * 1000;

function weekdayOf(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00Z`).getUTCDay();
}

function to24(hour: number, part: Part | null, hasJam: boolean): number {
  if (part === "pagi") return hour === 12 ? 12 : hour;
  if (part === "siang") return hour >= 1 && hour <= 4 ? hour + 12 : hour;
  if (part === "sore") return hour < 12 ? hour + 12 : hour;
  if (part === "malam") return hour === 12 ? 0 : hour < 12 ? hour + 12 : hour;
  return hasJam && hour >= 1 && hour <= 5 ? hour + 12 : hour;
}

function detectPart(text: string): Part | null {
  if (/\b(subuh|dini hari)\b/.test(text)) return "pagi";
  if (/\b(pagi)\b/.test(text)) return "pagi";
  if (/\b(siang|tengah hari)\b/.test(text)) return "siang";
  if (/\b(sore|sunset|sunsetan|senja|matahari terbenam)\b/.test(text)) return "sore";
  if (/\b(malam|malem)\b/.test(text)) return "malam";
  return null;
}

export function parseWhen(query: string, now: Date): ParsedWhen {
  const raw = query.toLowerCase();
  const text = normalize(query);
  const todayKey = getWibDateKey(now);
  const todayWd = weekdayOf(todayKey);
  const result: ParsedWhen = { ...EMPTY_WHEN };

  // ---- jam
  const jamForm = raw.match(/\b(?:jam|pukul|pkl)\s*(\d{1,2})(?:[.:](\d{2}))?/);
  const clockForm = raw.match(/\b(\d{1,2})[.:](\d{2})\b/);
  const partWord = raw.match(/\b(\d{1,2})\s*(pagi|siang|sore|malam|malem)\b/);
  const part = detectPart(text);

  if (partWord) {
    const p = (partWord[2] === "malem" ? "malam" : partWord[2]) as Part;
    result.hour = to24(Number(partWord[1]), p, false);
    result.part = p;
  } else if (jamForm) {
    result.hour = to24(Number(jamForm[1]), part, true);
    result.part = part;
  } else if (clockForm && Number(clockForm[1]) <= 24) {
    result.hour = to24(Number(clockForm[1]), part, false);
    result.part = part;
  } else {
    result.part = part;
  }
  if (result.hour !== null && (result.hour < 0 || result.hour > 23)) result.hour = null;

  if (/\b(sekarang|saat ini|barusan)\b/.test(text)) {
    result.isNow = true;
    result.dayOffset = 0;
    result.hour = Number(formatWibTime(now).slice(0, 2));
  }

  // ---- hari
  const beyondPhrase = text.match(/\b(minggu|pekan|bulan|tahun) depan\b|\bseminggu lagi\b|\bsebulan lagi\b|\blibur(?:an)? (?:natal|lebaran|tahun baru)\b/);
  const nDays = text.match(/\b(\d+) (hari|minggu|bulan) (?:lagi|kedepan|ke depan)\b/);
  const dayKeys = [0, 1, 2].map((i) => getWibDateKey(new Date(now.getTime() + i * 86_400_000)));

  if (/\b(hari ini|hari ni|malam ini|pagi ini|siang ini|sore ini|nanti)\b/.test(text)) result.dayOffset = 0;
  else if (/\b(besok|esok)\b/.test(text)) result.dayOffset = 1;
  else if (/\blusa\b/.test(text)) result.dayOffset = 2;

  if (result.dayOffset === null) {
    if (/\bkemarin\b/.test(text)) {
      result.beyond = "kemarin (sudah lewat)";
    } else if (beyondPhrase) {
      result.beyond = beyondPhrase[0];
    } else if (nDays) {
      const count = Number(nDays[1]) * (nDays[2] === "hari" ? 1 : nDays[2] === "minggu" ? 7 : 30);
      if (count <= 2) result.dayOffset = count;
      else result.beyond = `${nDays[1]} ${nDays[2]} lagi`;
    }
  }

  if (result.dayOffset === null && !result.beyond) {
    const dateMatch = text.match(new RegExp(`\\b(\\d{1,2}) (${MONTHS.join("|")})\\b`));
    if (dateMatch) {
      const month = MONTHS.indexOf(dateMatch[2]) + 1;
      const candidate = `${todayKey.slice(0, 4)}-${String(month).padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
      const idx = dayKeys.indexOf(candidate);
      if (idx >= 0) result.dayOffset = idx;
      else result.beyond = `tanggal ${dateMatch[1]} ${dateMatch[2]}`;
    }
  }

  if (result.dayOffset === null && !result.beyond) {
    const named = text.match(/\b(?:hari )?(senin|selasa|rabu|kamis|jumat|jum at|sabtu|ahad)\b|\bhari minggu\b/);
    if (named) {
      const word = named[1] ?? "minggu";
      const weekdayOfName: Record<string, number> = {
        senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum at": 5, sabtu: 6, minggu: 0, ahad: 0,
      };
      const wdTarget = weekdayOfName[word] ?? 0;
      const offset = (wdTarget - todayWd + 7) % 7;
      if (offset <= 2) result.dayOffset = offset;
      else result.beyond = `hari ${DAY_NAMES[wdTarget]} (${offset} hari lagi)`;
    } else if (/\b(weekend|wiken|akhir pekan|sabtu minggu)\b/.test(text)) {
      const offset = todayWd === 0 ? 0 : (6 - todayWd + 7) % 7;
      if (offset <= 2) result.dayOffset = offset;
      else result.beyond = `akhir pekan (${offset} hari lagi)`;
    }
  }

  return result;
}

/** Label manusiawi untuk waktu yang diminta, mis. "besok siang" atau "hari ini pukul 13.00 WIB". */
export function describeWhen(when: Pick<ParsedWhen, "hour" | "part">, dayOffset: number): string {
  const day = ["hari ini", "besok", "lusa"][dayOffset] ?? `+${dayOffset} hari`;
  if (when.hour !== null) return `${day} pukul ${String(when.hour).padStart(2, "0")}.00 WIB`;
  if (when.part) return dayOffset === 0 ? `${PART_LABEL[when.part]} ini` : `${day} ${PART_LABEL[when.part]}`;
  return day;
}

export type SlotPick = {
  slot: ScoredSlot | null;
  /** ok = slot buka berskor; closed = ada slot tetapi tutup; past = semua sudah lewat; no_forecast = tidak ada data. */
  status: "ok" | "closed" | "past" | "no_forecast";
};

const startMs = (slot: ScoredSlot) => new Date(slot.validAt).getTime();
const localHour = (slot: ScoredSlot) => Number(slot.localTime.slice(11, 13));

/**
 * Pilih slot pada `dayKey` sesuai permintaan: jam tepat (slot yang memuatnya), bagian hari
 * (slot buka berskor tertinggi di rentangnya), atau tanpa preferensi (slot buka terbaik hari itu).
 * Slot yang sudah berakhir tidak dipilih.
 */
export function pickSlot(
  slots: ScoredSlot[],
  dayKey: string,
  when: Pick<ParsedWhen, "hour" | "part">,
  now: Date,
): SlotPick {
  const daySlots = slots.filter((slot) => slot.localTime.startsWith(dayKey));
  if (daySlots.length === 0) return { slot: null, status: "no_forecast" };
  const nowMs = now.getTime();
  const upcoming = daySlots.filter((slot) => startMs(slot) + SLOT_MS > nowMs);

  if (when.hour !== null) {
    const instant = Date.parse(`${dayKey}T${String(when.hour).padStart(2, "0")}:00:00+07:00`);
    const containing = daySlots.find((slot) => startMs(slot) <= instant && instant < startMs(slot) + SLOT_MS);
    if (!containing) return { slot: null, status: "no_forecast" };
    if (startMs(containing) + SLOT_MS <= nowMs) return { slot: containing, status: "past" };
    return { slot: containing, status: containing.isOpen && containing.score !== null ? "ok" : "closed" };
  }

  if (upcoming.length === 0) return { slot: daySlots[daySlots.length - 1], status: "past" };

  const partSlots = when.part
    ? daySlots.filter((slot) => {
        const [from, to] = PART_RANGE[when.part as Part];
        const hour = localHour(slot);
        return hour >= from && hour < to;
      })
    : daySlots;
  if (partSlots.length === 0) return { slot: null, status: "no_forecast" };
  const pool = partSlots.filter((slot) => startMs(slot) + SLOT_MS > nowMs);
  if (pool.length === 0) return { slot: partSlots[partSlots.length - 1], status: "past" };

  let best: ScoredSlot | null = null;
  for (const slot of pool) {
    if (!slot.isOpen || slot.score === null) continue;
    if (!best || slot.score > (best.score as number)) best = slot;
  }
  if (best) return { slot: best, status: "ok" };
  return { slot: pool[0], status: "closed" };
}
