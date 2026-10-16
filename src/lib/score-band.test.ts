import { describe, expect, it } from "vitest";
import { BAND_COLOR, getScoreBand, SCORE_LABEL, SCORE_RANGE } from "./score-band";

describe("getScoreBand", () => {
  it.each([
    [100, "good"],
    [75, "good"],
    [74, "mid"],
    [50, "mid"],
    [49, "bad"],
    [0, "bad"],
  ] as const)("skor %i -> %s (batas rentang sesuai desain)", (score, band) => {
    expect(getScoreBand(score)).toBe(band);
  });

  it("slot tanpa skor (di luar jam buka) berstatus tutup", () => {
    expect(getScoreBand(null)).toBe("closed");
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    "menolak skor di luar 0-100: %s",
    (score) => {
      expect(() => getScoreBand(score)).toThrow(RangeError);
    },
  );
});

describe("SCORE_LABEL", () => {
  it("memakai label persis seperti di PRD F3", () => {
    expect(SCORE_LABEL).toEqual({
      good: "Sangat sesuai",
      mid: "Cukup sesuai",
      bad: "Kurang sesuai",
      closed: "Tutup",
    });
  });
});

describe("SCORE_RANGE and BAND_COLOR", () => {
  it("menyediakan rentang skor dan warna penanda lengkap", () => {
    expect(SCORE_RANGE.good).toBe("≥ 75");
    expect(SCORE_RANGE.mid).toBe("50–74");
    expect(SCORE_RANGE.bad).toBe("< 50");
    expect(SCORE_RANGE.closed).toBe("—");

    expect(BAND_COLOR.good).toBe("#1a6b4f");
    expect(BAND_COLOR.mid).toBe("#8a5a00");
    expect(BAND_COLOR.bad).toBe("#b3261e");
    expect(BAND_COLOR.closed).toBe("#66635c");
  });
});
