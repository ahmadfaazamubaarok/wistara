// Pembantu untuk tes integrasi (berjalan di database uji, lihat global-setup.ts).

import { Client } from "pg";
import { loadSeed } from "../../scripts/lib/seed";
import { getPool } from "@/lib/db";
import { getWibDateKey } from "@/lib/wib";

const HOUR = 3_600_000;

/** Tanggal kalender WIB besok ("YYYY-MM-DD"), relatif terhadap jam nyata saat tes berjalan. */
export function tomorrowKey(now = new Date()): string {
  return getWibDateKey(new Date(now.getTime() + 24 * HOUR));
}

/** Awal slot (instan UTC) untuk jam lokal WIB tertentu pada tanggal WIB tertentu. */
export function slotAt(dateKey: string, hourWib: number): Date {
  const hh = String(hourWib).padStart(2, "0");
  return new Date(Date.parse(`${dateKey}T${hh}:00:00Z`) - 7 * HOUR);
}

export type TestSlot = { hourWib: number; weatherDesc?: string; t?: number; ws?: number; hu?: number };

/**
 * Ganti seluruh prakiraan satu wilayah dengan slot uji pada tanggal WIB tertentu.
 * `fetchedHoursAgo`: kapan terakhir "berhasil diambil" (null = belum pernah).
 * Nilai di bawah 6 jam berarti segar, 6-13 jam memicu refresh, di atas 13 jam = data lama.
 */
export async function setForecast(
  adm4: string,
  dateKey: string,
  slots: TestSlot[],
  options: { fetchedHoursAgo?: number | null; lastAttemptHoursAgo?: number } = {},
) {
  const pool = getPool();
  await pool.query("delete from forecasts where adm4_code = $1", [adm4]);
  for (const slot of slots) {
    await pool.query(
      `insert into forecasts (adm4_code, valid_at, local_time, t, hu, ws, wd, tcc, weather_desc, analysis_date)
       values ($1, $2, ($2::timestamptz at time zone 'Asia/Jakarta'), $3, $4, $5, 'E', 50, $6, now())`,
      [adm4, slotAt(dateKey, slot.hourWib).toISOString(), slot.t ?? 27, slot.hu ?? 80, slot.ws ?? 8, slot.weatherDesc ?? "Cerah"],
    );
  }
  await setFetchState(adm4, options);
}

export async function setFetchState(
  adm4: string,
  options: { fetchedHoursAgo?: number | null; lastAttemptHoursAgo?: number } = {},
) {
  const ago = options.fetchedHoursAgo === undefined ? 0 : options.fetchedHoursAgo;
  await getPool().query(
    `insert into forecast_fetches (adm4_code, last_success_at, last_attempt_at)
     values ($1,
             case when $2::float8 is null then null else now() - make_interval(secs => $2::float8 * 3600) end,
             now() - make_interval(secs => $3::float8 * 3600))
     on conflict (adm4_code) do update set
       last_success_at = excluded.last_success_at,
       last_attempt_at = excluded.last_attempt_at,
       last_status = null,
       last_error = null`,
    [adm4, ago, options.lastAttemptHoursAgo ?? 1],
  );
}

export async function setMarineFetchState(
  areaCode: string,
  options: { fetchedHoursAgo?: number | null; lastAttemptHoursAgo?: number } = {},
) {
  const ago = options.fetchedHoursAgo === undefined ? 0 : options.fetchedHoursAgo;
  await getPool().query(
    `insert into marine_fetches (area_code, last_success_at, last_attempt_at)
     values ($1,
             case when $2::float8 is null then null else now() - make_interval(secs => $2::float8 * 3600) end,
             now() - make_interval(secs => $3::float8 * 3600))
     on conflict (area_code) do update set
       last_success_at = excluded.last_success_at,
       last_attempt_at = excluded.last_attempt_at,
       last_status = null,
       last_error = null`,
    [areaCode, ago, options.lastAttemptHoursAgo ?? 1],
  );
}

/** Hapus semua prakiraan dan status pengambilan (untuk skenario "belum ada data"). */
export async function clearForecasts() {
  await getPool().query("truncate forecasts, forecast_fetches, marine_forecasts, marine_fetches");
}

/** Buat semua destinasi berjam buka tetap tiap hari 08.00-17.00 agar hasil tes tidak bergantung hari. */
export async function openEveryDay() {
  const hours = JSON.stringify(
    Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, ["08:00", "17:00"]])),
  );
  await getPool().query("update destinations set open_hours = $1::jsonb where open_hours is not null", [hours]);
}

/** Kembalikan data seed asli (jam buka, dll.) setelah tes yang mengubahnya. Idempoten. */
export async function restoreSeed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await loadSeed(client);
  } finally {
    await client.end();
  }
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Panggil route handler langsung (tanpa server HTTP) dan baca balasannya sebagai JSON. */
export async function call<C>(handler: Handler<C>, path: string, context?: C) {
  const response = await handler(new Request(`http://localhost${path}`), (context ?? {}) as C);
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* bukan JSON */
  }
  return { status: response.status, headers: response.headers, json, text };
}

export const withSlug = (slug: string) => ({ params: Promise.resolve({ slug }) });

/** Kirim permintaan (metode apa pun) ke route handler, opsional dengan token Bearer dan body JSON. */
export async function send<C>(
  handler: Handler<C>,
  method: string,
  path: string,
  options: { token?: string; body?: unknown; rawBody?: string; context?: C; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const hasBody = options.body !== undefined || options.rawBody !== undefined;
  if (hasBody) headers["content-type"] = "application/json";

  const response = await handler(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: hasBody ? (options.rawBody ?? JSON.stringify(options.body)) : undefined,
    }),
    (options.context ?? {}) as C,
  );
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 204 atau bukan JSON */
  }
  return { status: response.status, headers: response.headers, json, text };
}

export const withId = (id: string) => ({ params: Promise.resolve({ id }) });
export const withItem = (id: string, itemId: string) => ({ params: Promise.resolve({ id, itemId }) });
