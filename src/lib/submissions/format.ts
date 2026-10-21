import { DEFAULT_VISIT_WINDOW, type OpenHours } from "../scoring/open-hours";
import { WEEK_DAYS } from "./constants";

/**
 * Ringkasan jam buka yang mudah dibaca peninjau.
 *   null                          -> "Tanpa batas jam (jendela bawaan 06:00–18:00)"
 *   jam sama setiap hari buka     -> "08:00–17:00, setiap hari" / "08:00–17:00, tutup Senin, Selasa"
 *   jam berbeda antarhari         -> "Senin 08:00–12:00; Selasa 09:00–17:00"
 */
export function summarizeOpenHours(openHours: OpenHours | null): string {
  if (openHours === null) {
    return `Tanpa batas jam (jendela bawaan ${DEFAULT_VISIT_WINDOW[0]}–${DEFAULT_VISIT_WINDOW[1]})`;
  }

  const open = WEEK_DAYS.filter((day) => openHours[day.key]);
  if (open.length === 0) return "Tutup setiap hari";

  const ranges = new Set(open.map((day) => openHours[day.key]!.join("–")));
  if (ranges.size === 1) {
    const [range] = [...ranges];
    const closed = WEEK_DAYS.filter((day) => !openHours[day.key]);
    return closed.length === 0 ? `${range}, setiap hari` : `${range}, tutup ${closed.map((day) => day.label).join(", ")}`;
  }
  return open.map((day) => `${day.label} ${openHours[day.key]!.join("–")}`).join("; ");
}
