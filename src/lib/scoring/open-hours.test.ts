import { describe, expect, it } from "vitest";
import { isOpenAtLocalTime, openHoursSchema, parseOpenHours, type OpenHours } from "./open-hours";

// 2026-10-16 = Jumat, 2026-10-17 = Sabtu, 2026-10-19 = Senin.
const KERATON: OpenHours = {
  mon: ["08:30", "14:00"], tue: ["08:30", "14:00"], wed: ["08:30", "14:00"], thu: ["08:30", "14:00"],
  fri: ["08:30", "13:00"], sat: ["08:30", "14:00"], sun: ["08:30", "14:00"],
};
const MUSEUM_TUTUP_SENIN: OpenHours = { tue: ["08:30", "16:00"], wed: ["08:30", "16:00"] };

describe("isOpenAtLocalTime", () => {
  it("jam mulai di dalam jam buka -> buka", () => {
    expect(isOpenAtLocalTime(KERATON, "2026-10-17T09:00:00")).toBe(true);
    expect(isOpenAtLocalTime(KERATON, "2026-10-17T12:00:00")).toBe(true);
  });

  it("slot 06.00 untuk tempat yang buka 08.30 -> tutup (mulai sebelum buka)", () => {
    expect(isOpenAtLocalTime(KERATON, "2026-10-17T06:00:00")).toBe(false);
  });

  it("batas: tepat jam buka = buka, tepat jam tutup = tutup", () => {
    expect(isOpenAtLocalTime({ sat: ["09:00", "15:00"] }, "2026-10-17T09:00:00")).toBe(true);
    expect(isOpenAtLocalTime({ sat: ["09:00", "15:00"] }, "2026-10-17T15:00:00")).toBe(false);
  });

  it("jam tutup berbeda per hari (Jumat lebih awal)", () => {
    expect(isOpenAtLocalTime(KERATON, "2026-10-16T12:00:00")).toBe(true); // Jumat 12.00 < 13.00
    expect(isOpenAtLocalTime(KERATON, "2026-10-16T15:00:00")).toBe(false);
    expect(isOpenAtLocalTime(KERATON, "2026-10-17T12:00:00")).toBe(true); // Sabtu
  });

  it("hari tanpa kunci = tutup seharian", () => {
    expect(isOpenAtLocalTime(MUSEUM_TUTUP_SENIN, "2026-10-19T12:00:00")).toBe(false); // Senin
    expect(isOpenAtLocalTime(MUSEUM_TUTUP_SENIN, "2026-10-20T12:00:00")).toBe(true); // Selasa
  });

  it("tanpa jam buka (null): jendela bawaan 06.00-18.00 setiap hari", () => {
    for (const [time, expected] of [
      ["00:00", false], ["03:00", false], ["06:00", true], ["09:00", true],
      ["12:00", true], ["15:00", true], ["18:00", false], ["21:00", false],
    ] as const) {
      expect(isOpenAtLocalTime(null, `2026-10-17T${time}:00`), time).toBe(expected);
    }
  });

  it("mendukung penutupan pukul 24.00", () => {
    expect(isOpenAtLocalTime({ sat: ["18:00", "24:00"] }, "2026-10-17T21:00:00")).toBe(true);
  });

  it("menolak format waktu lokal yang salah", () => {
    expect(() => isOpenAtLocalTime(null, "kemarin")).toThrow(RangeError);
  });
});

describe("openHoursSchema / parseOpenHours", () => {
  it("menerima format dari Rancangan Teknis", () => {
    expect(openHoursSchema.safeParse({ mon: ["08:00", "16:00"] }).success).toBe(true);
  });

  it.each([
    [{ mon: ["16:00", "08:00"] }],
    [{ mon: ["8:00", "16:00"] }],
    [{ senin: ["08:00", "16:00"] }],
    [{ mon: ["08:00"] }],
  ])("menolak %j", (value) => {
    expect(openHoursSchema.safeParse(value).success).toBe(false);
  });

  it("parseOpenHours: null/undefined -> null, rusak -> null (tidak melempar)", () => {
    expect(parseOpenHours(null)).toBeNull();
    expect(parseOpenHours(undefined)).toBeNull();
    expect(parseOpenHours({ mon: "bukan array" })).toBeNull();
    expect(parseOpenHours({ mon: ["08:00", "16:00"] })).toEqual({ mon: ["08:00", "16:00"] });
  });
});
