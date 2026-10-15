// Semua waktu yang ditampilkan ke pengguna memakai WIB (PRD F2), sementara
// server (Vercel dan container dev) berjalan di UTC. Jangan memakai
// Date#getHours()/toLocaleString tanpa timeZone; selalu lewat helper ini.

const WIB_TIME_ZONE = "Asia/Jakarta";

function partsOf(date: Date, options: Intl.DateTimeFormatOptions) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WIB_TIME_ZONE,
    ...options,
  }).formatToParts(date);
  return (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
}

/** Jam WIB bergaya Indonesia, mis. "15.00" (tengah malam = "00.00"). */
export function formatWibTime(date: Date): string {
  const pick = partsOf(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${pick("hour")}.${pick("minute")}`;
}

/** Tanggal kalender WIB sebagai "YYYY-MM-DD", dipakai untuk mengelompokkan Hari ini/Besok/Lusa. */
export function getWibDateKey(date: Date): string {
  const pick = partsOf(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}
