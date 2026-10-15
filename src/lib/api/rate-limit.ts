// Pembatasan laju untuk endpoint tulis. Penghitungnya di tabel Postgres (rate_limits)
// karena memori fungsi serverless tidak bertahan antar-permintaan.

import { getPool } from "../db";
import { ApiError } from "./errors";

export const WRITE_LIMIT = 30; // permintaan tulis
export const WRITE_WINDOW_SECONDS = 60; // per menit, per pengguna

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
