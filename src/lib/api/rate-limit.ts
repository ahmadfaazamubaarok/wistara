// Pembatasan laju untuk endpoint tulis. Penghitungnya di tabel Postgres (rate_limits)
// karena memori fungsi serverless tidak bertahan antar-permintaan.

import { getPool } from "../db";
import { ApiError } from "./errors";

export const WRITE_LIMIT = 30; // permintaan tulis
export const WRITE_WINDOW_SECONDS = 60; // per menit, per pengguna

// Pencarian alamat dari peta. Nominatim publik membatasi 1 permintaan per detik untuk SEMUA pemakai,
// jadi ada batas per pengguna dan batas global (di bawah 60 per menit).
export const GEOCODE_USER_LIMIT = 20;
export const GEOCODE_GLOBAL_LIMIT = 40;
export const GEOCODE_WINDOW_SECONDS = 60;

/** Berbeda dari batas lain: tidak melempar galat, karena saran alamat bersifat opsional. */
export async function allowGeocode(userId: string): Promise<boolean> {
  const pool = getPool();
  const hit = async (bucket: string, limit: number) =>
    (await pool.query<{ allowed: boolean }>("select allowed from rate_limit_hit($1, $2, $3)", [bucket, limit, GEOCODE_WINDOW_SECONDS])).rows[0]
      .allowed;
  const userOk = await hit(`geocode:${userId}`, GEOCODE_USER_LIMIT);
  if (!userOk) return false;
  return hit("geocode:global", GEOCODE_GLOBAL_LIMIT);
}

export const SUBMISSION_LIMIT = 5; // usulan destinasi
export const SUBMISSION_WINDOW_SECONDS = 3600; // per jam, per pengguna

/** Usulan destinasi jauh lebih jarang daripada penulisan biasa, jadi batasnya lebih ketat. */
export async function enforceSubmissionLimit(userId: string): Promise<void> {
  const { rows } = await getPool().query<{ allowed: boolean; hits: number; retry_after: number }>(
    "select * from rate_limit_hit($1, $2, $3)",
    [`submit:${userId}`, SUBMISSION_LIMIT, SUBMISSION_WINDOW_SECONDS],
  );
  const result = rows[0];
  if (!result.allowed) {
    const minutes = Math.ceil(result.retry_after / 60);
    throw new ApiError(
      "RATE_LIMITED",
      `Terlalu banyak usulan (maksimal ${SUBMISSION_LIMIT} per jam). Coba lagi dalam ${minutes} menit.`,
      { "Retry-After": String(result.retry_after) },
    );
  }
}

export async function enforceWriteLimit(userId: string): Promise<void> {
  const { rows } = await getPool().query<{ allowed: boolean; hits: number; retry_after: number }>(
    "select * from rate_limit_hit($1, $2, $3)",
    [`write:${userId}`, WRITE_LIMIT, WRITE_WINDOW_SECONDS],
  );
  const result = rows[0];
  if (!result.allowed) {
    throw new ApiError(
      "RATE_LIMITED",
      `Terlalu banyak permintaan tulis (maksimal ${WRITE_LIMIT} per menit). Coba lagi dalam ${result.retry_after} detik.`,
      { "Retry-After": String(result.retry_after) },
    );
  }
}
