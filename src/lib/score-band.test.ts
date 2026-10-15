import { describe, expect, it } from "vitest";
import { getScoreBand, SCORE_LABEL } from "./score-band";

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
