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

export const SCORE_RANGE: Record<ScoreBand, string> = {
  good: "≥ 75",
  mid: "50–74",
  bad: "< 50",
  closed: "—",
};

// Warna penanda peta sesuai token desain (kontras >= 3:1 pada peta).
export const BAND_COLOR: Record<ScoreBand, string> = {
  good: "#1a6b4f",
  mid: "#8a5a00",
  bad: "#b3261e",
  closed: "#66635c",
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
