// Teks antarmuka untuk status laut. Satu sumber untuk badge, tooltip peta,
// kartu kondisi laut, dan halaman Tentang Data.
//
// Prinsip:
// - Status terendah hanya MENYEBUT DATA ("Gelombang rendah"), tidak memberi
//   perintah dan tidak menjanjikan apa pun. Hanya Waspada dan Bahaya yang
//   memakai kata perintah.
// - Kata "aman" tidak dipakai untuk kondisi laut maupun lokasi di pantai.
// - Data BMKG berlaku per WILAYAH PERAIRAN, bukan per pantai, dan berupa
//   prakiraan model, bukan hasil sensor.

import type { SeaStatus } from "./sea-status";

/** Teks pendek pada badge, tanpa angka. */
export function seaBadgeText(status: SeaStatus, waveCat?: string | null): string {
  switch (status) {
    case "perhatian":
      return waveCat?.trim().toLowerCase() === "tenang" ? "Gelombang tenang" : "Gelombang rendah";
    case "waspada":
      return "Waspada";
    case "bahaya":
      return "Bahaya";
    default:
      return "Data laut belum tersedia";
  }
}

/** Keterangan kategori untuk Waspada dan Bahaya, mis. "gelombang sedang". */
export function seaCategoryText(waveCat?: string | null): string | null {
  const cat = waveCat?.trim();
  return cat ? `gelombang ${cat.toLowerCase()}` : null;
}

/** Format tinggi gelombang Indonesia, mis. 1.5 -> "1,5 m". */
export function formatWaveHeight(height: number | null | undefined): string | null {
  if (height === null || height === undefined || !Number.isFinite(height)) return null;
  return `${height.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m`;
}

/** Teks lengkap badge, mis. "Waspada · gelombang sedang 1,9 m" atau "Gelombang rendah · 1,1 m". */
export function seaBadgeFullText(
  status: SeaStatus,
  waveCat?: string | null,
  waveHeight?: number | null,
): string {
  const head = seaBadgeText(status, waveCat);
  if (status === "informasi_terbatas") return head;
  const height = formatWaveHeight(waveHeight);
  if (status === "perhatian") return height ? `${head} · ${height}` : head;
  const detail = [seaCategoryText(waveCat), height].filter(Boolean).join(" ");
  return detail ? `${head} · ${detail}` : head;
}

/** Kalimat pendamping satu baris. */
export const SEA_STATUS_HINT: Record<SeaStatus, string> = {
  perhatian: "Arus balik tetap bisa terjadi di pantai selatan.",
  waspada: "Hindari bermain air di luar zona yang ditandai petugas.",
  bahaya: "Jangan bermain air.",
  informasi_terbatas: "Tanyakan zona yang boleh dipakai bermain air ke petugas di lokasi.",
};

/** Kalimat tetap yang selalu tampil bersama status laut. */
export const SEA_FIXED_NOTICE =
  "Status berlaku untuk wilayah perairan, bukan jaminan kondisi di bibir pantai. Ikuti arahan petugas di lokasi.";

/** Label untuk pembaca layar. */
export function seaAriaLabel(status: SeaStatus, waveCat?: string | null, waveHeight?: number | null): string {
  return `Status laut: ${seaBadgeFullText(status, waveCat, waveHeight)}. ${SEA_STATUS_HINT[status]}`;
}
