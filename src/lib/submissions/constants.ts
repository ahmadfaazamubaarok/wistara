// Konstanta usulan destinasi yang dipakai server dan formulir. Nilai harus sama dengan check
// constraint di supabase/migrations/20261021000100_usulan_destinasi.sql.

export const KABUPATEN_DIY = ["Kota Yogyakarta", "Sleman", "Bantul", "Kulon Progo", "Gunungkidul"] as const;
export type KabupatenDiy = (typeof KABUPATEN_DIY)[number];

export const MANAGER_ROLES = ["pengelola", "pemilik", "pemdes", "komunitas", "lainnya"] as const;
export type ManagerRole = (typeof MANAGER_ROLES)[number];

export const MANAGER_ROLE_LABEL: Record<ManagerRole, string> = {
  pengelola: "Pengelola destinasi",
  pemilik: "Pemilik",
  pemdes: "Pemerintah desa / kelurahan",
  komunitas: "Komunitas / kelompok sadar wisata",
  lainnya: "Lainnya",
};

export const SUBMISSION_STATUSES = ["menunggu", "disetujui", "ditolak"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  menunggu: "Menunggu ditinjau",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};

/** Urutan hari untuk formulir (Senin lebih dulu), dengan kunci yang sama seperti open_hours. */
export const WEEK_DAYS = [
  { key: "mon", label: "Senin" },
  { key: "tue", label: "Selasa" },
  { key: "wed", label: "Rabu" },
  { key: "thu", label: "Kamis" },
  { key: "fri", label: "Jumat" },
  { key: "sat", label: "Sabtu" },
  { key: "sun", label: "Minggu" },
] as const;

/** Usulan yang masih menunggu per pengguna (juga dijaga trigger di database). */
export const MAX_PENDING_PER_USER = 5;
