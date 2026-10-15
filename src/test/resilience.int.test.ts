import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getForecast } from "@/app/api/v1/destinations/[slug]/forecast/route";
import { GET as getHealth } from "@/app/api/v1/health/route";
import { BmkgError } from "@/lib/bmkg/client";
import type { ParsedForecast } from "@/lib/bmkg/parser";
import { forecastResponseSchema, healthResponseSchema } from "@/lib/api/schemas";
import { getPool } from "@/lib/db";
import { getRegionForecast, REFRESH_AFTER_MS, STALE_AFTER_MS } from "@/lib/weather/service";
import { call, clearForecasts, setFetchState, setForecast, tomorrowKey, withSlug } from "./helpers";

const PARANGTRITIS = "34.02.03.2002";
const day = tomorrowKey();

/** Prakiraan BMKG tiruan dengan slot di masa depan (relatif terhadap jam nyata). */
function fakeBmkg(adm4: string): ParsedForecast {
  const start = Math.ceil(Date.now() / 10_800_000) * 10_800_000;
  return {
    location: { adm4, desa: "Parangtritis", kecamatan: "Kretek", kabupaten: "Bantul", lat: -8, lon: 110.3 },
    slots: Array.from({ length: 8 }, (_, i) => {
      const validAt = new Date(start + i * 10_800_000);
      return {
        validAt,
        localTime: new Date(validAt.getTime() + 7 * 3_600_000).toISOString().slice(0, 19),
        t: 27, hu: 80, ws: 8, wd: "E", tcc: 40, vsText: null, weatherDesc: "Cerah", analysisDate: new Date(),
      };
    }),
  };
}

const fetchState = async (adm4: string) =>
  (await getPool().query("select * from forecast_fetches where adm4_code = $1", [adm4])).rows[0];

beforeEach(async () => {
  await clearForecasts();
  vi.spyOn(console, "error").mockImplementation(() => undefined); // galat BMKG yang disengaja
});
afterEach(() => vi.restoreAllMocks());

describe("layanan cuaca: refresh saat dibaca", () => {
  it("data segar (< 6 jam) dilayani dari database tanpa memanggil BMKG", async () => {
    await setForecast(PARANGTRITIS, day, [{ hourWib: 9 }], { fetchedHoursAgo: 1 });
    const fetcher = vi.fn();
    const result = await getRegionForecast(PARANGTRITIS, { fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.rows).toHaveLength(1);
    expect(result.isStale).toBe(false);
  });

  it("data lebih tua dari 6 jam memicu pengambilan ulang dan hasilnya tersimpan", async () => {
    const olderThanRefresh = REFRESH_AFTER_MS / 3_600_000 + 1;
    await setForecast(PARANGTRITIS, day, [{ hourWib: 9 }], { fetchedHoursAgo: olderThanRefresh });
    const fetcher = vi.fn().mockResolvedValue(fakeBmkg(PARANGTRITIS));

    const result = await getRegionForecast(PARANGTRITIS, { fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(PARANGTRITIS);
    expect(result.isStale).toBe(false);
    expect(result.rows.length).toBeGreaterThanOrEqual(8);
    expect((await fetchState(PARANGTRITIS)).last_status).toBe(200);
    expect(Date.now() - result.fetchedAt!.getTime()).toBeLessThan(10_000);
  });

  it("BMKG gagal dan data > 13 jam: data terakhir tetap dikirim, ditandai isStale, galat tercatat", async () => {
    const stale = STALE_AFTER_MS / 3_600_000 + 1;
    await setForecast(PARANGTRITIS, day, [{ hourWib: 9 }, { hourWib: 12 }], { fetchedHoursAgo: stale });
    const fetcher = vi.fn().mockRejectedValue(new BmkgError("BMKG membalas HTTP 503", 503));

    const result = await getRegionForecast(PARANGTRITIS, { fetcher });

    expect(result.rows).toHaveLength(2); // data lama tetap tersaji
    expect(result.isStale).toBe(true);
    const state = await fetchState(PARANGTRITIS);
    expect(state.last_status).toBe(503);
    expect(state.last_error).toContain("503");
  });

  it("setelah gagal, percobaan berikutnya ditahan 2 menit (tidak menghajar BMKG yang sedang bermasalah)", async () => {
    await setForecast(PARANGTRITIS, day, [{ hourWib: 9 }], { fetchedHoursAgo: 20 });
    const fetcher = vi.fn().mockRejectedValue(new BmkgError("down", 503));
    await getRegionForecast(PARANGTRITIS, { fetcher });
    await getRegionForecast(PARANGTRITIS, { fetcher });
    await getRegionForecast(PARANGTRITIS, { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("belum pernah ada data dan BMKG gagal: kosong tapi ditandai isStale, tanpa melempar galat", async () => {
    const fetcher = vi.fn().mockRejectedValue(new BmkgError("down", null));
    const result = await getRegionForecast(PARANGTRITIS, { fetcher });
    expect(result.rows).toEqual([]);
    expect(result.isStale).toBe(true);
    expect(result.fetchedAt).toBeNull();
  });

  it("banyak permintaan serentak pada data basi hanya memicu SATU pengambilan (beban BMKG tidak naik)", async () => {
    await setForecast(PARANGTRITIS, day, [{ hourWib: 9 }], { fetchedHoursAgo: 8 });
    const fetcher = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return fakeBmkg(PARANGTRITIS);
    });

    const results = await Promise.all(Array.from({ length: 12 }, () => getRegionForecast(PARANGTRITIS, { fetcher })));

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.rows.length > 0)).toBe(true); // yang lain langsung dilayani dari cache
  });
});

describe("API saat BMKG tidak bisa diakses (uji ketahanan di Rancangan Teknis)", () => {
  it("forecast tetap 200 dengan source.isStale = true dan data terakhir", async () => {
    // BMKG_API_BASE_URL diarahkan ke port tertutup oleh global-setup, jadi pengambilan nyata gagal.
    await setForecast(PARANGTRITIS, day, [{ hourWib: 9 }, { hourWib: 12 }], { fetchedHoursAgo: 14 });

    const result = await call(getForecast, "/x", withSlug("pantai-parangtritis"));

    expect(result.status).toBe(200);
    const body = forecastResponseSchema.parse(result.json);
    expect(body.source.isStale).toBe(true);
    expect(body.slots).toHaveLength(2);
    expect(body.slots[0].score).toBe(100);
  });

  it("tanpa data sama sekali pun tetap 200 (daftar kosong, isStale)", async () => {
    const result = await call(getForecast, "/x", withSlug("pantai-parangtritis"));
    expect(result.status).toBe(200);
    const body = forecastResponseSchema.parse(result.json);
    expect(body.slots).toEqual([]);
    expect(body.source).toMatchObject({ isStale: true, fetchedAt: null });
  });
});

describe("GET /api/v1/health", () => {
  async function freshenAll(hoursAgo: number) {
    const { rows } = await getPool().query<{ adm4_code: string }>("select distinct adm4_code from destinations");
    for (const row of rows) await setFetchState(row.adm4_code, { fetchedHoursAgo: hoursAgo });
  }

  it("ok saat database hidup dan semua data BMKG segar", async () => {
    await freshenAll(1);
    const result = await call(getHealth, "/x");
    expect(result.status).toBe(200);
    const body = healthResponseSchema.parse(result.json);
    expect(body.status).toBe("ok");
    expect(body.database.status).toBe("up");
    expect(body.bmkg).toMatchObject({ regions: 17, staleRegions: 0 });
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  it("degraded (tetap HTTP 200) bila ada wilayah dengan data lebih dari 13 jam", async () => {
    await freshenAll(1);
    await setFetchState(PARANGTRITIS, { fetchedHoursAgo: 14 });
    const result = await call(getHealth, "/x");
    expect(result.status).toBe(200); // situs masih melayani data terakhir
    const body = healthResponseSchema.parse(result.json);
    expect(body.status).toBe("degraded");
    expect(body.bmkg?.staleRegions).toBe(1);
  });

  it("wilayah yang belum pernah berhasil dihitung sebagai data lama", async () => {
    await freshenAll(1);
    await setFetchState(PARANGTRITIS, { fetchedHoursAgo: null });
    const body = healthResponseSchema.parse((await call(getHealth, "/x")).json);
    expect(body.bmkg?.staleRegions).toBe(1);
  });
});
