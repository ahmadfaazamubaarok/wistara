// Layanan cuaca maritim: menyajikan data BMKG Maritim dari DATABASE
// dan menyegarkannya dengan pola "refresh saat dibaca" (Rancangan Teknis).

import { BmkgError } from "../bmkg/client";
import { fetchMarineForecast } from "../bmkg/marine-client";
import type { ParsedMarineForecast } from "../bmkg/marine-parser";
import { getPool } from "../db";

export const MARINE_REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
export const MARINE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
export const MARINE_ATTEMPT_COOLDOWN = "2 minutes";

export type MarineRow = {
  validAt: Date;
  resolutionMinutes: number;
  waveCat: string | null;
  waveHeight: number | null;
  windFrom: string | null;
  windSpeedKt: number | null;
  windGustKt: number | null;
  currentTo: string | null;
  currentSpeedKt: number | null;
  weather: string | null;
  issuedAt: Date;
  stationName: string | null;
};

export type MarineAreaForecast = {
  rows: MarineRow[];
  issuedAt: Date | null;
  fetchedAt: Date | null;
  stationName: string | null;
  areaName: string | null;
  isStale: boolean;
};

export type MarineDeps = {
  now?: Date;
  fetcher?: (code: string) => Promise<ParsedMarineForecast>;
};

type FetchState = {
  last_success_at: Date | null;
};

async function readState(code: string): Promise<FetchState> {
  const { rows } = await getPool().query<FetchState>(
    "select last_success_at from marine_fetches where area_code = $1",
    [code],
  );
  return rows[0] ?? { last_success_at: null };
}

async function acquireRefreshLock(code: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `insert into marine_fetches (area_code, last_attempt_at)
     values ($1, now())
     on conflict (area_code) do update set last_attempt_at = now()
       where marine_fetches.last_attempt_at is null
          or marine_fetches.last_attempt_at < now() - interval '${MARINE_ATTEMPT_COOLDOWN}'
     returning area_code`,
    [code],
  );
  return (rowCount ?? 0) > 0;
}

async function storeMarineForecast(code: string, forecast: ParsedMarineForecast): Promise<void> {
  const points = forecast.points;
  const client = await getPool().connect();
  try {
    await client.query("begin");
    if (points.length > 0) {
      await client.query(
        `insert into marine_forecasts
           (area_code, valid_at, resolution_minutes, wave_cat, wave_height, wind_from,
            wind_speed_kt, wind_gust_kt, current_to, current_speed_kt, weather,
            issued_at, station_name, fetched_at)
         select $1, x.valid_at, x.resolution_minutes, x.wave_cat, x.wave_height, x.wind_from,
                x.wind_speed_kt, x.wind_gust_kt, x.current_to, x.current_speed_kt, x.weather,
                $12, $13, now()
         from unnest($2::timestamptz[], $3::int[], $4::text[], $5::numeric[], $6::text[],
                     $7::numeric[], $8::numeric[], $9::text[], $10::numeric[], $11::text[])
           as x(valid_at, resolution_minutes, wave_cat, wave_height, wind_from,
                wind_speed_kt, wind_gust_kt, current_to, current_speed_kt, weather)
         on conflict (area_code, valid_at) do update set
           resolution_minutes = excluded.resolution_minutes,
           wave_cat = excluded.wave_cat,
           wave_height = excluded.wave_height,
           wind_from = excluded.wind_from,
           wind_speed_kt = excluded.wind_speed_kt,
           wind_gust_kt = excluded.wind_gust_kt,
           current_to = excluded.current_to,
           current_speed_kt = excluded.current_speed_kt,
           weather = excluded.weather,
           issued_at = excluded.issued_at,
           station_name = excluded.station_name,
           fetched_at = excluded.fetched_at`,
        [
          code,
          points.map((p) => p.validAt.toISOString()),
          points.map((p) => p.resolutionMinutes),
          points.map((p) => p.waveCat),
          points.map((p) => p.waveHeight),
          points.map((p) => p.windFrom),
          points.map((p) => p.windSpeedKt),
          points.map((p) => p.windGustKt),
          points.map((p) => p.currentTo),
          points.map((p) => p.currentSpeedKt),
          points.map((p) => p.weather),
          forecast.issuedAt.toISOString(),
          forecast.stationName,
        ],
      );
    }

    // Hapus data yang sudah lebih dari 24 jam lalu
    await client.query(
      "delete from marine_forecasts where area_code = $1 and valid_at < now() - interval '24 hours'",
      [code],
    );

    await client.query(
      `update marine_fetches
         set last_success_at = now(), last_status = 200, last_error = null
       where area_code = $1`,
      [code],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function recordFailure(code: string, error: unknown): Promise<void> {
  const status = error instanceof BmkgError ? error.status : null;
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  await getPool().query(
    "update marine_fetches set last_status = $2, last_error = $3 where area_code = $1",
    [code, status, message],
  );
}

type DbMarineRow = {
  valid_at: Date;
  resolution_minutes: number;
  wave_cat: string | null;
  wave_height: string | null;
  wind_from: string | null;
  wind_speed_kt: string | null;
  wind_gust_kt: string | null;
  current_to: string | null;
  current_speed_kt: string | null;
  weather: string | null;
  issued_at: Date;
  station_name: string | null;
  area_name: string | null;
};

const num = (v: string | null) => (v === null ? null : Number(v));

async function readMarineRows(
  code: string,
): Promise<{ rows: MarineRow[]; issuedAt: Date | null; stationName: string | null; areaName: string | null }> {
  const { rows } = await getPool().query<DbMarineRow>(
    `select f.valid_at, f.resolution_minutes, f.wave_cat, f.wave_height, f.wind_from,
            f.wind_speed_kt, f.wind_gust_kt, f.current_to, f.current_speed_kt, f.weather,
            f.issued_at, f.station_name, a.name as area_name
     from marine_forecasts f
     left join marine_areas a on a.code = f.area_code
     where f.area_code = $1
     order by f.valid_at asc`,
    [code],
  );

  let areaName: string | null = null;
  if (rows.length > 0 && rows[0].area_name) {
    areaName = rows[0].area_name;
  } else {
    const areaRes = await getPool().query<{ name: string }>(
      "select name from marine_areas where code = $1",
      [code],
    );
    areaName = areaRes.rows[0]?.name ?? null;
  }

  const mapped: MarineRow[] = rows.map((r) => ({
    validAt: r.valid_at,
    resolutionMinutes: r.resolution_minutes,
    waveCat: r.wave_cat,
    waveHeight: num(r.wave_height),
    windFrom: r.wind_from,
    windSpeedKt: num(r.wind_speed_kt),
    windGustKt: num(r.wind_gust_kt),
    currentTo: r.current_to,
    currentSpeedKt: num(r.current_speed_kt),
    weather: r.weather,
    issuedAt: r.issued_at,
    stationName: r.station_name,
  }));

  const issuedAt = mapped.reduce<Date | null>(
    (latest, row) => (!latest || row.issuedAt > latest ? row.issuedAt : latest),
    null,
  );
  const stationName = mapped[0]?.stationName ?? null;

  return { rows: mapped, issuedAt, stationName, areaName };
}

export async function refreshMarineRegion(code: string, fetcher = fetchMarineForecast): Promise<boolean> {
  try {
    const forecast = await fetcher(code);
    await storeMarineForecast(code, forecast);
    return true;
  } catch (error) {
    console.error(`[marine] gagal memperbarui perairan ${code}:`, error instanceof Error ? error.message : error);
    await recordFailure(code, error).catch(() => undefined);
    return false;
  }
}

export async function warmMarineRegion(
  code: string,
  fetcher: (code: string) => Promise<ParsedMarineForecast> = (c) => fetchMarineForecast(c),
): Promise<"refreshed" | "failed" | "skipped"> {
  if (!(await acquireRefreshLock(code))) return "skipped";
  return (await refreshMarineRegion(code, fetcher)) ? "refreshed" : "failed";
}

export async function getAreaForecast(code: string, deps: MarineDeps = {}): Promise<MarineAreaForecast> {
  const now = deps.now ?? new Date();
  const fetcher = deps.fetcher ?? ((c: string) => fetchMarineForecast(c));

  let state = await readState(code);
  const age = state.last_success_at ? now.getTime() - state.last_success_at.getTime() : Infinity;

  if (age > MARINE_REFRESH_AFTER_MS && (await acquireRefreshLock(code))) {
    if (await refreshMarineRegion(code, fetcher)) {
      state = await readState(code);
    }
  }

  const { rows, issuedAt, stationName, areaName } = await readMarineRows(code);
  const lastOk = state.last_success_at;

  return {
    rows,
    issuedAt,
    fetchedAt: lastOk,
    stationName,
    areaName,
    isStale: !lastOk || now.getTime() - lastOk.getTime() > MARINE_STALE_AFTER_MS,
  };
}
