import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getAlternatives } from "@/app/api/v1/destinations/[slug]/alternatives/route";
import { GET as getForecast } from "@/app/api/v1/destinations/[slug]/forecast/route";
import { alternativesResponseSchema, forecastResponseSchema } from "@/lib/api/schemas";
import { getPool } from "@/lib/db";
import {
  call,
  clearForecasts,
  openEveryDay,
  restoreSeed,
  setFetchState,
  setForecast,
  tomorrowKey,
  withSlug,
} from "./helpers";

// Wilayah (adm4) dari data seed. BMKG memakai grid jam yang berbeda fase antar-wilayah:
//   fase "00": slot berjam lokal 00,03,06,09,12,...   fase "01": 01,04,07,10,13,...
const PARANGTRITIS = "34.02.03.2002"; // fase 00, pantai
const PRAMBANAN = "34.04.09.2006"; // fase 01, budaya
const AFFANDI = "34.04.07.2001"; // fase 01, museum (sefase dengan Prambanan)
const NGUPASAN = "34.71.10.1001"; // fase 00, Vredeburg dan Sonobudoyo (BEDA fase dari Prambanan)

const day = tomorrowKey();
const at = (hour: number) => `${day}T${String(hour).padStart(2, "0")}:00:00+07:00`;
const alternativesUrl = (hour: number) => `/x?slot=${encodeURIComponent(at(hour))}`;

async function freshenAllRegions() {
  const { rows } = await getPool().query<{ adm4_code: string }>("select adm4_code from regions");
  for (const row of rows) await setFetchState(row.adm4_code, { fetchedHoursAgo: 0 });
}

// Berkas ini menyeragamkan jam buka; pulihkan agar tes lain melihat data seed asli.
afterAll(restoreSeed);

beforeEach(async () => {
  await clearForecasts();
  await openEveryDay(); // jam buka seragam agar hasil tes tidak bergantung hari dalam seminggu
  await freshenAllRegions(); // semua wilayah segar: tidak ada pengambilan BMKG yang tak disengaja
});

describe("GET /destinations/{slug}/forecast", () => {
  it("menghitung skor, label, dan alasan persis seperti contoh di Rancangan Teknis", async () => {
    await setForecast(PARANGTRITIS, day, [
      { hourWib: 9, weatherDesc: "Berawan", ws: 12, t: 28 }, // contoh 1: skor 100
      { hourWib: 12, weatherDesc: "Hujan Ringan", ws: 25, t: 31 }, // contoh 2: skor 25
      { hourWib: 21 }, // di luar jendela kunjungan 06.00-18.00
    ]);

    const result = await call(getForecast, "/x", withSlug("pantai-parangtritis"));
    expect(result.status).toBe(200);
    const body = forecastResponseSchema.parse(result.json);
    const byHour = (h: number) => body.slots.find((s) => s.localTime === at(h));

    expect(byHour(9)).toMatchObject({ score: 100, label: "Sangat sesuai", band: "good", reasons: [] });
    expect(byHour(12)).toMatchObject({
      score: 25,
      label: "Kurang sesuai",
      band: "bad",
      reasons: ["Hujan ringan diprakirakan (-40)", "Angin 25 km/jam (-27)"],
      dominantPenalty: "rain",
    });
    expect(byHour(21)).toMatchObject({ score: null, label: "Tutup", band: "closed", isOpen: false, reasons: [] });

    expect(body.bestByDay).toHaveLength(1);
    expect(body.bestByDay[0]).toMatchObject({ date: day, score: 100, localTime: at(9) });
    expect(body.source).toMatchObject({ provider: "BMKG", isStale: false });
    expect(body.source.analysisDate).not.toBeNull();
  });

  it("parameter days membatasi hari yang dikirim", async () => {
    await setForecast(PARANGTRITIS, day, [{ hourWib: 9 }]);
    const one = forecastResponseSchema.parse((await call(getForecast, "/x?days=1", withSlug("pantai-parangtritis"))).json);
    const two = forecastResponseSchema.parse((await call(getForecast, "/x?days=2", withSlug("pantai-parangtritis"))).json);
    expect(one.slots).toHaveLength(0); // besok bukan "hari 1"
    expect(two.slots).toHaveLength(1);
  });

  it("slot di luar jam buka tidak dinilai dan tidak ikut menjadi yang terbaik", async () => {
    // Jam buka diseragamkan 08.00-17.00 (beforeEach); slot 20.00 pasti di luar jam buka.
    await setForecast("34.71.09.1002", day, [{ hourWib: 20 }]);
    const body = forecastResponseSchema.parse((await call(getForecast, "/x", withSlug("keraton-yogyakarta"))).json);
    expect(body.slots[0]).toMatchObject({ score: null, label: "Tutup" });
    expect(body.bestByDay).toEqual([]);
  });

  it("teks cuaca BMKG yang tidak dikenal: penalti 0 dan dicatat ke log, tidak error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await setForecast(PARANGTRITIS, day, [{ hourWib: 9, weatherDesc: "Hujan Lokal" }]);
    const body = forecastResponseSchema.parse((await call(getForecast, "/x", withSlug("pantai-parangtritis"))).json);
    expect(body.slots[0].score).toBe(100);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Hujan Lokal"));
    warn.mockRestore();
  });
});

describe("GET /destinations/{slug}/alternatives (F5)", () => {
  beforeEach(async () => {
    // Prambanan hujan sedang pukul 10.00; museum cerah. Perhatikan fase jam yang berbeda:
    await setForecast(PRAMBANAN, day, [{ hourWib: 10, weatherDesc: "Hujan Sedang" }, { hourWib: 13 }]);
    await setForecast(AFFANDI, day, [{ hourWib: 10 }, { hourWib: 13 }]);
    await setForecast(NGUPASAN, day, [{ hourWib: 9 }, { hourWib: 12 }]); // bergeser 1 jam
  });

  it("terpicu saat skor < 50 dan penalti terbesarnya hujan; terdekat lebih dulu; skor >= 60", async () => {
    const result = await call(getAlternatives, alternativesUrl(10), withSlug("candi-prambanan"));
    expect(result.status).toBe(200);
    const body = alternativesResponseSchema.parse(result.json);

    expect(body.triggered).toBe(true);
    expect(body.slot).toMatchObject({ band: "bad", dominantPenalty: "rain", hasAlternatives: true });
    expect(body.slot.score).toBeLessThan(50);
    // Sonobudoyo (±15,1 km) dan Ullen Sentalu (>15 km) di luar radius 15 km.
    expect(body.alternatives.map((a) => a.slug)).toEqual(["museum-affandi", "museum-benteng-vredeburg"]);
    expect(body.alternatives.every((a) => a.score >= 60)).toBe(true);
    expect(body.alternatives[0].distanceM).toBeLessThan(body.alternatives[1].distanceM);
    expect(body.otherSlot).toBeNull();
  });

  it("menemukan alternatif di wilayah yang jam slotnya bergeser (bug nyata: grid BMKG beda fase)", async () => {
    // Vredeburg memakai slot 09.00 dan 12.00, sedangkan Prambanan 10.00 dan 13.00.
    // Mencocokkan validAt yang persis sama akan melewatkannya tanpa error apa pun.
    const body = alternativesResponseSchema.parse(
      (await call(getAlternatives, alternativesUrl(10), withSlug("candi-prambanan"))).json,
    );
    expect(body.alternatives.map((a) => a.slug)).toContain("museum-benteng-vredeburg");
  });

  it("slot dalam jam yang sama (di tengah slot) tetap menemukan slot yang memuatnya", async () => {
    const body = alternativesResponseSchema.parse(
      (await call(getAlternatives, alternativesUrl(11), withSlug("candi-prambanan"))).json,
    );
    expect(body.slot.localTime).toBe(at(10));
    expect(body.triggered).toBe(true);
  });

  it("museum yang tutup pada slot itu tidak disarankan", async () => {
    await getPool().query(
      `update destinations set open_hours = '{"sun":["14:00","17:00"],"mon":["14:00","17:00"],"tue":["14:00","17:00"],
        "wed":["14:00","17:00"],"thu":["14:00","17:00"],"fri":["14:00","17:00"],"sat":["14:00","17:00"]}'::jsonb
       where slug = 'museum-affandi'`,
    );
    const body = alternativesResponseSchema.parse(
      (await call(getAlternatives, alternativesUrl(10), withSlug("candi-prambanan"))).json,
    );
    expect(body.alternatives.map((a) => a.slug)).toEqual(["museum-benteng-vredeburg"]);
  });

  it("skor kandidat dihitung dari cuacanya sendiri; museum berskor < 60 tidak disarankan", async () => {
    // Bobot museum bawaan sangat kecil (hampir kebal cuaca), jadi naikkan bobot hujannya
    // sementara. Sekaligus membuktikan bobot disetel lewat basis data tanpa deploy ulang.
    await getPool().query("update score_profiles set w_rain = 1.0 where category = 'museum'");
    try {
      await setForecast(AFFANDI, day, [{ hourWib: 10, weatherDesc: "Hujan Lebat" }]); // skor 10
      const body = alternativesResponseSchema.parse(
        (await call(getAlternatives, alternativesUrl(10), withSlug("candi-prambanan"))).json,
      );
      expect(body.alternatives.map((a) => a.slug)).toEqual(["museum-benteng-vredeburg"]);
    } finally {
      await getPool().query("update score_profiles set w_rain = 0.1 where category = 'museum'");
    }
  });

  it("terpicu saat cuaca panas terik (dominant = heat)", async () => {
    await setForecast(PRAMBANAN, day, [{ hourWib: 13, t: 36 }]); // panas: skor 20, dominan heat
    const body = alternativesResponseSchema.parse(
      (await call(getAlternatives, alternativesUrl(13), withSlug("candi-prambanan"))).json,
    );
    expect(body.slot.score).toBeLessThan(50);
    expect(body.slot.dominantPenalty).toBe("heat");
    expect(body.triggered).toBe(true);
    expect(body.alternatives.length).toBeGreaterThan(0);
  });

  it("tanpa destinasi indoor dalam 15 km: sarankan slot lain di destinasi yang sama", async () => {
    await setForecast(PARANGTRITIS, day, [
      { hourWib: 9 }, // 100
      { hourWib: 12, weatherDesc: "Hujan Ringan", ws: 25, t: 31 }, // 25
    ]);
    const body = alternativesResponseSchema.parse(
      (await call(getAlternatives, alternativesUrl(12), withSlug("pantai-parangtritis"))).json,
    );
    expect(body.triggered).toBe(true);
    expect(body.alternatives).toEqual([]); // semua museum > 15 km dari Parangtritis
    expect(body.otherSlot).toMatchObject({ localTime: at(9), score: 100 });
  });

  it("forecast menandai hasAlternatives hanya pada slot yang punya alternatif", async () => {
    const body = forecastResponseSchema.parse((await call(getForecast, "/x", withSlug("candi-prambanan"))).json);
    expect(body.slots.find((s) => s.localTime === at(10))?.hasAlternatives).toBe(true);
    expect(body.slots.find((s) => s.localTime === at(13))?.hasAlternatives).toBe(false);
  });
});
