// Pemformat tampilan (bahasa Indonesia). Semua tanggal/jam dihitung dalam WIB.

/** 120 -> "120 m", 1400 -> "1,4 km", 12000 -> "12 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km >= 10 ? Math.round(km) : km.toFixed(1).replace(".", ",")} km`;
}

const DAY_NAMES = ["Hari ini", "Besok", "Lusa"] as const;

/** Nama hari relatif: indeks 0 = Hari ini, 1 = Besok, 2 = Lusa. */
export function relativeDayName(index: number): string {
  return DAY_NAMES[index] ?? `+${index} hari`;
}

/**
 * "2026-10-16" -> "Jum, 16 Okt". Kunci tanggal sudah berupa kalender WIB, jadi
 * diformat di UTC agar tidak bergeser oleh zona waktu mesin.
 */
export function formatDayKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dayKey;
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  const pick = (type: string) => (parts.find((p) => p.type === type)?.value ?? "").replace(/\./g, "");
  return `${pick("weekday")}, ${pick("day")} ${pick("month")}`;
}

/** "2026-10-16T15:00:00+07:00" -> "15.00" (jam WIB gaya Indonesia). */
export function slotHour(localTime: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(localTime);
  return match ? `${match[1]}.${match[2]}` : localTime;
}

const WEEK: { key: string; name: string }[] = [
  { key: "mon", name: "Sen" },
  { key: "tue", name: "Sel" },
  { key: "wed", name: "Rab" },
  { key: "thu", name: "Kam" },
  { key: "fri", name: "Jum" },
  { key: "sat", name: "Sab" },
  { key: "sun", name: "Min" },
];

const dotted = (hhmm: string) => hhmm.replace(":", ".");

/**
 * Ringkas jam buka: hari berurutan dengan jam sama digabung.
 * {mon..sun: 08:30-14:00} -> ["Sen–Min 08.30–14.00"]; hari tanpa kunci -> "Tutup Sen".
 */
export function summarizeOpenHours(openHours: Record<string, [string, string]>): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < WEEK.length) {
    const hours = openHours[WEEK[i].key];
    if (!hours) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < WEEK.length) {
      const next = openHours[WEEK[j + 1].key];
      if (!next || next[0] !== hours[0] || next[1] !== hours[1]) break;
      j += 1;
    }
    const range = i === j ? WEEK[i].name : `${WEEK[i].name}–${WEEK[j].name}`;
    lines.push(`${range} ${dotted(hours[0])}–${dotted(hours[1])}`);
    i = j + 1;
  }
  const closed = WEEK.filter((day) => !openHours[day.key]).map((day) => day.name);
  if (closed.length > 0 && closed.length < WEEK.length) lines.push(`Tutup ${closed.join(", ")}`);
  return lines;
}

/** Waktu WIB lengkap untuk keterangan: "16 Okt 2026, 07.12 WIB" dari instan UTC. */
export function formatWibDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("day")} ${pick("month").replace(".", "")} ${pick("year")}, ${pick("hour")}.${pick("minute")} WIB`;
}
