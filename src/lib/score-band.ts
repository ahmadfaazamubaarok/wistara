// Pemetaan skor kelayakan (0-100) ke status tampilan.
// Rentang dan label bersumber dari DESIGN-jelajahlokal.md ("Status skor
// kelayakan") dan PRD F3. Fungsi ini TIDAK menghitung skor; penghitungan skor
// ada di modul terpisah agar bisa diuji sendiri.

export type ScoreBand = "good" | "mid" | "bad" | "closed";

export const SCORE_LABEL: Record<ScoreBand, string> = {
  good: "Sangat sesuai",
  mid: "Cukup sesuai",
  bad: "Kurang sesuai",
  closed: "Tutup",
};

/**
 * @param score skor 0-100, atau `null` untuk slot di luar jam buka (tanpa skor).
 * @throws RangeError bila skor bukan angka berhingga di rentang 0-100.
 */
export function getScoreBand(score: number | null): ScoreBand {
  if (score === null) return "closed";
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError(`Skor harus berada di rentang 0-100, diterima: ${score}`);
  }
  if (score >= 75) return "good";
  if (score >= 50) return "mid";
  return "bad";
}
