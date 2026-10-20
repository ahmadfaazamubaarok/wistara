import { withApi } from "@/lib/api/errors";
import { noStoreJson } from "@/lib/api/http";
import { getPool } from "@/lib/db";
import { STALE_AFTER_MS } from "@/lib/weather/service";
import { MARINE_STALE_AFTER_MS } from "@/lib/weather/marine-service";
import { formatWibTime } from "@/lib/wib";

export const dynamic = "force-dynamic";

type BmkgHealth = {
  regions: number;
  staleRegions: number;
  lastSuccessAt: string | null;
  oldestSuccessAt: string | null;
};

type MarineHealth = {
  areas: number;
  staleAreas: number;
  lastSuccessAt: string | null;
  oldestSuccessAt: string | null;
};

/** Kesegaran data BMKG per wilayah yang dipakai destinasi. null bila tidak bisa dibaca. */
async function readBmkgHealth(): Promise<BmkgHealth | null> {
  try {
    const { rows } = await getPool().query<{
      regions: number;
      stale: number;
      last_success_at: Date | null;
      oldest_success_at: Date | null;
    }>(
      `select count(*)::int as regions,
              (count(*) filter (
                 where f.last_success_at is null
                    or f.last_success_at < now() - make_interval(secs => $1)
              ))::int as stale,
              max(f.last_success_at) as last_success_at,
              min(f.last_success_at) as oldest_success_at
       from (select distinct adm4_code from destinations) r
       left join forecast_fetches f on f.adm4_code = r.adm4_code`,
      [STALE_AFTER_MS / 1000],
    );
    const row = rows[0];
    return {
      regions: row.regions,
      staleRegions: row.stale,
      lastSuccessAt: row.last_success_at?.toISOString() ?? null,
      oldestSuccessAt: row.oldest_success_at?.toISOString() ?? null,
    };
  } catch (error) {
    console.error("[health] gagal membaca kesegaran BMKG:", error);
    return null;
  }
}

/** Kesegaran data BMKG Maritim per perairan DIY. null bila tidak bisa dibaca. */
async function readMarineHealth(): Promise<MarineHealth | null> {
  try {
    const { rows } = await getPool().query<{
      areas: number;
      stale: number;
      last_success_at: Date | null;
      oldest_success_at: Date | null;
    }>(
      `select count(*)::int as areas,
              (count(*) filter (
                 where f.last_success_at is null
                    or f.last_success_at < now() - make_interval(secs => $1)
              ))::int as stale,
              max(f.last_success_at) as last_success_at,
              min(f.last_success_at) as oldest_success_at
       from marine_areas a
       left join marine_fetches f on f.area_code = a.code`,
      [MARINE_STALE_AFTER_MS / 1000],
    );
    const row = rows[0];
    return {
      areas: row.areas,
      staleAreas: row.stale,
      lastSuccessAt: row.last_success_at?.toISOString() ?? null,
      oldestSuccessAt: row.oldest_success_at?.toISOString() ?? null,
    };
  } catch (error) {
    console.error("[health] gagal membaca kesegaran maritim BMKG:", error);
    return null;
  }
}

// GET /api/v1/health (PRD F9, F8).
// Status HTTP 503 hanya bila basis data tidak terjangkau. Data BMKG yang lama
// membuat status "degraded" tetapi tetap 200, karena situs masih melayani
// data terakhir dengan label "data lama".
export const GET = withApi(async () => {
  const now = new Date();
  const startedAt = performance.now();

  let database: { status: "up"; latencyMs: number } | { status: "down" };
  try {
    await getPool().query("SELECT 1");
    database = { status: "up", latencyMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    // Detail error hanya ke log server; jangan bocor ke respons publik.
    console.error("[health] basis data tidak dapat dijangkau:", error);
    database = { status: "down" };
  }

  const bmkg = database.status === "up" ? await readBmkgHealth() : null;
  const marine = database.status === "up" ? await readMarineHealth() : null;
  const healthy =
    database.status === "up" &&
    bmkg !== null &&
    bmkg.staleRegions === 0 &&
    marine !== null &&
    marine.staleAreas === 0;

  return noStoreJson(
    {
      status: healthy ? "ok" : "degraded",
      checkedAt: { utc: now.toISOString(), wib: formatWibTime(now) },
      database,
      bmkg,
      marine,
    },
    database.status === "up" ? 200 : 503,
  );
});
