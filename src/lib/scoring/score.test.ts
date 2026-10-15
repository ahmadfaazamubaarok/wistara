import { describe, expect, it, vi } from "vitest";
import { heatPenalty, rainPenalty, visibilityPenalty, windPenalty } from "./penalties";
import { scoreWeather, type ScoreProfile } from "./score";

// Bobot kategori dari Rancangan Teknis (tabel score_profiles).
const PANTAI: ScoreProfile = { wRain: 1.0, wWind: 0.8, wHeat: 0.5, wVis: 0.3 };
const ALAM: ScoreProfile = { wRain: 1.0, wWind: 0.5, wHeat: 0.3, wVis: 0.8 };
const MUSEUM: ScoreProfile = { wRain: 0.1, wWind: 0, wHeat: 0.1, wVis: 0 };

describe("contoh hitungan di Rancangan Teknis (pantai)", () => {
  it("09.00: Berawan, angin 12 km/jam, 28 °C -> skor 100, Sangat sesuai", () => {
    const result = scoreWeather({ weatherDesc: "Berawan", ws: 12, t: 28 }, PANTAI);
    expect(result.score).toBe(100);
    expect(result.band).toBe("good");
    expect(result.label).toBe("Sangat sesuai");
    expect(result.reasons).toEqual([]);
    expect(result.dominant).toBeNull();
  });

  it("15.00: Hujan Ringan, angin 25 km/jam, 31 °C -> skor 25, Kurang sesuai", () => {
    const result = scoreWeather({ weatherDesc: "Hujan Ringan", ws: 25, t: 31 }, PANTAI);
    // 40 + 26,7 + 8,3 = 75  ->  100 - 75 = 25
    expect(result.penalties.rain).toBeCloseTo(40);
    expect(result.penalties.wind).toBeCloseTo(26.667, 2);
    expect(result.penalties.heat).toBeCloseTo(8.333, 2);
    expect(result.score).toBe(25);
    expect(result.band).toBe("bad");
    expect(result.label).toBe("Kurang sesuai");
  });

  it("alasan sama dengan contoh respons API: hanya penalti > 10, terbesar dulu", () => {
    const result = scoreWeather({ weatherDesc: "Hujan Ringan", ws: 25, t: 31 }, PANTAI);
    // Suhu (8,3) tidak > 10 sehingga tidak ditampilkan.
    expect(result.reasons).toEqual(["Hujan ringan diprakirakan (-40)", "Angin 25 km/jam (-27)"]);
    expect(result.dominant).toBe("rain");
  });
});

describe("penalti per komponen", () => {
  it.each([
    ["Cerah", 0],
    ["Cerah Berawan", 0],
    ["Berawan", 0],
    ["Berawan Tebal", 10],
    ["Hujan Ringan", 40],
    ["Hujan Sedang", 70],
    ["Hujan Lebat", 90],
    ["Hujan Petir", 100],
    ["  hujan   ringan ", 40], // toleran huruf besar/kecil dan spasi
  ])("hujan: %s -> %i", (desc, expected) => {
    expect(rainPenalty(desc)).toBe(expected);
  });

  it.each([
    [0, 0],
    [15, 0],
    [30, 50],
    [45, 100],
    [80, 100],
  ])("angin %i km/jam -> %i", (ws, expected) => {
    expect(windPenalty(ws)).toBeCloseTo(expected);
  });

  it.each([
    [20, 0],
    [30, 0],
    [33, 50],
    [36, 100],
    [40, 100],
  ])("suhu %i °C -> %i", (t, expected) => {
    expect(heatPenalty(t)).toBeCloseTo(expected);
  });

  it.each([
    ["Kabut", 60],
    ["Asap", 60],
    ["Udara Kabur", 60],
    ["Cerah", 0],
    ["Hujan Lebat", 0],
  ])("jarak pandang: %s -> %i", (desc, expected) => {
    expect(visibilityPenalty(desc)).toBe(expected);
  });

  it("data kosong (null) tidak memberi penalti", () => {
    expect(windPenalty(null)).toBe(0);
    expect(heatPenalty(null)).toBe(0);
    expect(rainPenalty(null)).toBe(0);
  });
});

describe("skor", () => {
  it("tidak pernah di bawah 0", () => {
    const result = scoreWeather({ weatherDesc: "Hujan Petir", ws: 60, t: 40 }, PANTAI);
    expect(result.score).toBe(0);
  });

  it("museum nyaris tidak terpengaruh cuaca buruk", () => {
    const result = scoreWeather({ weatherDesc: "Hujan Petir", ws: 60, t: 40 }, MUSEUM);
    // 0,1*100 + 0 + 0,1*100 + 0 = 20
    expect(result.score).toBe(80);
    expect(result.band).toBe("good");
  });

  it("kabut menurunkan skor alam lebih besar daripada pantai", () => {
    const input = { weatherDesc: "Kabut", ws: 5, t: 22 };
    expect(scoreWeather(input, ALAM).score).toBe(52); // 100 - 0,8*60
    expect(scoreWeather(input, PANTAI).score).toBe(82); // 100 - 0,3*60
    expect(scoreWeather(input, ALAM).reasons).toEqual(["Kabut mengurangi jarak pandang (-48)"]);
    expect(scoreWeather(input, ALAM).dominant).toBe("vis");
  });

  it("maksimal 3 alasan", () => {
    const result = scoreWeather({ weatherDesc: "Kabut", ws: 45, t: 36 }, {
      wRain: 1, wWind: 1, wHeat: 1, wVis: 1,
    });
    expect(result.reasons.length).toBeLessThanOrEqual(3);
    expect(result.reasons).toHaveLength(3);
    // terurut menurun: angin (100) > suhu (100, kalah urutan) > kabut (60)
    expect(result.reasons[0]).toContain("Angin");
  });

  it("Berawan Tebal (penalti tepat 10) tidak dijadikan alasan", () => {
    const result = scoreWeather({ weatherDesc: "Berawan Tebal", ws: 5, t: 27 }, PANTAI);
    expect(result.score).toBe(90);
    expect(result.reasons).toEqual([]);
    expect(result.dominant).toBe("rain");
  });

  it("teks cuaca tidak dikenal: penalti 0 dan dilaporkan lewat hook", () => {
    const onUnknownWeather = vi.fn();
    const result = scoreWeather({ weatherDesc: "Hujan Lokal", ws: 5, t: 27 }, PANTAI, { onUnknownWeather });
    expect(result.score).toBe(100);
    expect(onUnknownWeather).toHaveBeenCalledWith("Hujan Lokal");
  });

  it("teks cuaca yang dikenal tidak memicu hook", () => {
    const onUnknownWeather = vi.fn();
    scoreWeather({ weatherDesc: "Kabut", ws: 5, t: 27 }, PANTAI, { onUnknownWeather });
    scoreWeather({ weatherDesc: null, ws: 5, t: 27 }, PANTAI, { onUnknownWeather });
    expect(onUnknownWeather).not.toHaveBeenCalled();
  });

  it("skor dibulatkan ke bilangan bulat", () => {
    const result = scoreWeather({ weatherDesc: "Cerah", ws: 20, t: 30 }, PANTAI);
    // angin: 5/30*100 = 16,67 * 0,8 = 13,33 -> 100 - 13,33 = 86,67 -> 87
    expect(result.score).toBe(87);
    expect(Number.isInteger(result.score)).toBe(true);
  });
});
