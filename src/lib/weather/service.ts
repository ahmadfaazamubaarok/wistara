// Layanan cuaca: menyajikan prakiraan dari DATABASE dan memperbaruinya dari BMKG
// dengan pola "refresh saat dibaca" (Rancangan Teknis, bagian Ketahanan).
//
//  - Data wilayah lebih tua dari 6 jam -> permintaan berikutnya memicu pengambilan.
//  - Hanya SATU permintaan yang boleh mengambil per wilayah (kunci atomik di SQL);
//    permintaan lain langsung dilayani dari cache. Dengan begitu beban ke BMKG tidak
//    bertambah walau pengguna banyak (batas BMKG 60 permintaan/menit/IP).
//  - Bila BMKG gagal, data terakhir tetap dikirim; isStale = true bila keberhasilan
//    terakhir lebih dari 13 jam lalu.

import { fetchBmkgForecast, BmkgError } from "../bmkg/client";
import type { ParsedForecast } from "../bmkg/parser";
import { getPool } from "../db";
import type { ForecastRow } from "../forecast/slots";

export const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
export const STALE_AFTER_MS = 13 * 60 * 60 * 1000;
/** Jeda minimum antar-percobaan mengambil dari BMKG untuk satu wilayah. */
export const ATTEMPT_COOLDOWN = "2 minutes";

export type RegionForecast = {
  rows: ForecastRow[];
  /** Waktu produksi prakiraan oleh BMKG (analysis_date terbaru); null bila belum ada data. */
  analysisDate: Date | null;
  /** Waktu terakhir kita berhasil mengambil dari BMKG; null bila belum pernah. */
  fetchedAt: Date | null;
  /** True bila belum pernah berhasil atau keberhasilan terakhir > 13 jam lalu. */
  isStale: boolean;
};

export type WeatherDeps = {
  now?: Date;
  fetcher?: (adm4: string) => Promise<ParsedForecast>;
};

type FetchState = { last_success_at: Date | null };

async function readState(adm4: string): Promise<FetchState> {
  const { rows } = await getPool().query<FetchState>(
    "select last_success_at from forecast_fetches where adm4_code = $1",
    [adm4],
  );
  return rows[0] ?? { last_success_at: null };
}

/**
 * Satu pernyataan atomik: menyisipkan baris baru, atau memperbarui last_attempt_at
 * HANYA bila percobaan sebelumnya sudah lewat masa jeda. Mengembalikan baris bila
 * kita yang memenangkan kunci.
 */
async function acquireRefreshLock(adm4: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `insert into forecast_fetches (adm4_code, last_attempt_at)
     values ($1, now())
     on conflict (adm4_code) do update set last_attempt_at = now()
       where forecast_fetches.last_attempt_at is null
          or forecast_fetches.last_attempt_at < now() - interval '${ATTEMPT_COOLDOWN}'
     returning adm4_code`,
    [adm4],
  );
  return (rowCount ?? 0) > 0;
}

async function storeForecast(adm4: string, forecast: ParsedForecast): Promise<void> {
  const slots = forecast.slots;
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into forecasts
         (adm4_code, valid_at, local_time, t, hu, ws, wd, tcc, vs_text, weather_desc, analysis_date, fetched_at)
       select $1, x.valid_at, x.local_time, x.t, x.hu, x.ws, x.wd, x.tcc, x.vs_text, x.weather_desc, x.analysis_date, now()
       from unnest($2::timestamptz[], $3::timestamp[], $4::numeric[], $5::numeric[], $6::numeric[],
                   $7::text[], $8::numeric[], $9::text[], $10::text[], $11::timestamptz[])
         as x(valid_at, local_time, t, hu, ws, wd, tcc, vs_text, weather_desc, analysis_date)
       on conflict (adm4_code, valid_at) do update set
         local_time = excluded.local_time, t = excluded.t, hu = excluded.hu, ws = excluded.ws,
         wd = excluded.wd, tcc = excluded.tcc, vs_text = excluded.vs_text,
         weather_desc = excluded.weather_desc, analysis_date = excluded.analysis_date,
         fetched_at = excluded.fetched_at`,
      [
        adm4,
        slots.map((s) => s.validAt.toISOString()),
        slots.map((s) => s.localTime),
        slots.map((s) => s.t),
        slots.map((s) => s.hu),
        slots.map((s) => s.ws),
        slots.map((s) => s.wd),
        slots.map((s) => s.tcc),
        slots.map((s) => s.vsText),
        slots.map((s) => s.weatherDesc),
        slots.map((s) => s.analysisDate.toISOString()),
      ],
    );
    // Slot yang sudah lama lewat tidak dipakai lagi.
    await client.query("delete from forecasts where adm4_code = $1 and valid_at < now() - interval '24 hours'", [adm4]);
    await client.query(
      `update forecast_fetches
         set last_success_at = now(), last_status = 200, last_error = null
       where adm4_code = $1`,
      [adm4],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function recordFailure(adm4: string, error: unknown): Promise<void> {
  const status = error instanceof BmkgError ? error.status : null;
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  await getPool().query(
    "update forecast_fetches set last_status = $2, last_error = $3 where adm4_code = $1",
    [adm4, status, message],
  );
}

type DbRow = {
  valid_at: Date;
  local_time: string;
  t: string | null;
  hu: string | null;
  ws: string | null;
  wd: string | null;
  tcc: string | null;
  weather_desc: string | null;
  analysis_date: Date;
};

const num = (value: string | null) => (value === null ? null : Number(value));

async function readRows(adm4: string): Promise<{ rows: ForecastRow[]; analysisDate: Date | null }> {
  const { rows } = await getPool().query<DbRow>(
    `select valid_at, to_char(local_time, 'YYYY-MM-DD"T"HH24:MI:SS') as local_time,
            t, hu, ws, wd, tcc, weather_desc, analysis_date
     from forecasts where adm4_code = $1 order by valid_at`,
    [adm4],
  );
  const mapped: ForecastRow[] = rows.map((row) => ({
    validAt: row.valid_at,
    localTime: row.local_time,
    t: num(row.t),
    hu: num(row.hu),
    ws: num(row.ws),
    wd: row.wd,
    tcc: num(row.tcc),
    weatherDesc: row.weather_desc,
  }));
  const analysisDate = rows.reduce<Date | null>(
    (latest, row) => (!latest || row.analysis_date > latest ? row.analysis_date : latest),
    null,
  );
  return { rows: mapped, analysisDate };
}

/** Ambil dari BMKG dan simpan; true bila berhasil. Tidak pernah melempar. */
export async function refreshRegion(adm4: string, fetcher = fetchBmkgForecast): Promise<boolean> {
  try {
    const forecast = await fetcher(adm4);
    await storeForecast(adm4, forecast);
    return true;
  } catch (error) {
    console.error(`[weather] gagal memperbarui ${adm4}:`, error instanceof Error ? error.message : error);
    await recordFailure(adm4, error).catch(() => undefined);
    return false;
  }
}

/**
 * Dipakai cron harian: menyegarkan satu wilayah tanpa menunggu umur 6 jam,
 * tetapi tetap menghormati kunci agar tidak bentrok dengan refresh saat dibaca.
 * Hasil: "refreshed" | "failed" | "skipped" (sedang/baru saja diambil proses lain).
 */
export async function warmRegion(
  adm4: string,
  fetcher: (adm4: string) => Promise<ParsedForecast> = (code) => fetchBmkgForecast(code),
): Promise<"refreshed" | "failed" | "skipped"> {
  if (!(await acquireRefreshLock(adm4))) return "skipped";
  return (await refreshRegion(adm4, fetcher)) ? "refreshed" : "failed";
}

export async function getRegionForecast(adm4: string, deps: WeatherDeps = {}): Promise<RegionForecast> {
  const now = deps.now ?? new Date();
  const fetcher = deps.fetcher ?? ((code: string) => fetchBmkgForecast(code));

  let state = await readState(adm4);
  const age = state.last_success_at ? now.getTime() - state.last_success_at.getTime() : Infinity;

  if (age > REFRESH_AFTER_MS && (await acquireRefreshLock(adm4))) {
    if (await refreshRegion(adm4, fetcher)) state = await readState(adm4);
  }

  const { rows, analysisDate } = await readRows(adm4);
  const lastOk = state.last_success_at;
  return {
    rows,
    analysisDate,
    fetchedAt: lastOk,
    isStale: !lastOk || now.getTime() - lastOk.getTime() > STALE_AFTER_MS,
  };
}
