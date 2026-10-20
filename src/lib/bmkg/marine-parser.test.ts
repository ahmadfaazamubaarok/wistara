import { describe, expect, it, vi } from "vitest";
import fixture from "./__fixtures__/marine-P.N.03.json";
import { BmkgParseError } from "./parser";
import { parseMarineResponse, parseMarineUtc } from "./marine-parser";

describe("parseMarineResponse (fixture P.N.03)", () => {
  const parsed = parseMarineResponse(fixture);

  it("membaca metadata wilayah dan stasiun", () => {
    expect(parsed.code).toBe("P.N.03");
    expect(parsed.name).toBe("Perairan Gunungkidul");
    expect(parsed.stationName).toBe("STASIUN METEOROLOGI KELAS II YOGYAKARTA");
    expect(parsed.issuedAt).toEqual(new Date("2026-10-17T12:00:00Z"));
  });

  it("menggabungkan forecast_day1 dan forecast_day2-4 menjadi satu array terurut waktu", () => {
    expect(parsed.points.length).toBe(5);
    const times = parsed.points.map((p) => p.validAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("waktu duplikat di day2-4 memakai titik resolusi 60 dari day1", () => {
    // Pada jam 2026-10-18 02:00 UTC ada di day1 (resolusi 60) dan day2-4 (resolusi 180)
    const dupPoint = parsed.points.find((p) => p.validAt.toISOString() === "2026-10-18T02:00:00.000Z");
    expect(dupPoint).toBeDefined();
    expect(dupPoint?.resolutionMinutes).toBe(60);
    expect(dupPoint?.weather).toBe("Berawan Tebal");
  });

  it("titik di day2-4 memiliki resolusi 180", () => {
    const pointDay2 = parsed.points.find((p) => p.validAt.toISOString() === "2026-10-19T00:00:00.000Z");
    expect(pointDay2).toBeDefined();
    expect(pointDay2?.resolutionMinutes).toBe(180);
    expect(pointDay2?.waveCat).toBe("Sedang");
    expect(pointDay2?.waveHeight).toBe(2.4);
  });
});

describe("parseMarineResponse (penanganan nilai tak lazim & error)", () => {
  it("memanggil hook onUnknownWaveCat saat menemukan wave_cat tak dikenal", () => {
    const hook = vi.fn();
    const badCat = structuredClone(fixture);
    badCat.forecast_day1[0].wave_cat = "Tsunami Super";
    parseMarineResponse(badCat, { onUnknownWaveCat: hook });
    expect(hook).toHaveBeenCalledWith("Tsunami Super");
  });

  it("dapat menangani nilai null pada field numerik", () => {
    const withNulls = structuredClone(fixture);
    const item = withNulls.forecast_day1[0] as unknown as { wave_height: unknown; wind_gust: unknown };
    item.wave_height = null;
    item.wind_gust = null;
    const parsed = parseMarineResponse(withNulls);
    expect(parsed.points[0].waveHeight).toBeNull();
    expect(parsed.points[0].windGustKt).toBeNull();
  });

  it("menolak struktur JSON yang rusak", () => {
    expect(() => parseMarineResponse({ code: "P.N.03" })).toThrow(BmkgParseError);
    expect(() => parseMarineResponse(null)).toThrow(BmkgParseError);
    expect(() => parseMarineResponse("bukan json")).toThrow(BmkgParseError);
  });

  it("menolak format waktu maritim yang salah", () => {
    expect(() => parseMarineUtc("bukan-waktu", "test")).toThrow(BmkgParseError);
  });
});
