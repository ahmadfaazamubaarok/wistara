import { describe, expect, it } from "vitest";
import {
  formatDayKey,
  formatDistance,
  formatWibDateTime,
  relativeDayName,
  slotHour,
  summarizeOpenHours,
} from "./format";

describe("formatDistance", () => {
  it.each([
    [0, "0 m"],
    [59, "59 m"],
    [999, "999 m"],
    [1000, "1,0 km"],
    [1400, "1,4 km"],
    [9949, "9,9 km"],
    [12000, "12 km"],
    [15000, "15 km"],
  ])("%i m -> %s", (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected);
  });
});

describe("relativeDayName", () => {
  it("Hari ini, Besok, Lusa", () => {
    expect([0, 1, 2].map(relativeDayName)).toEqual(["Hari ini", "Besok", "Lusa"]);
  });
});

describe("formatDayKey", () => {
  it("memformat tanggal kalender WIB tanpa bergeser zona", () => {
    expect(formatDayKey("2026-10-16")).toBe("Jum, 16 Okt");
    expect(formatDayKey("2026-10-17")).toBe("Sab, 17 Okt");
  });

  it("kunci tidak valid dikembalikan apa adanya", () => {
    expect(formatDayKey("bukan-tanggal")).toBe("bukan-tanggal");
  });
});

describe("slotHour", () => {
  it("mengambil jam WIB dari waktu lokal ISO", () => {
    expect(slotHour("2026-10-16T15:00:00+07:00")).toBe("15.00");
    expect(slotHour("2026-10-16T06:30:00+07:00")).toBe("06.30");
  });
});

describe("summarizeOpenHours", () => {
  const all = (open: string, close: string) =>
    Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, [open, close]])) as Record<string, [string, string]>;

  it("setiap hari sama -> satu baris rentang", () => {
    expect(summarizeOpenHours(all("06:30", "17:00"))).toEqual(["Sen–Min 06.30–17.00"]);
  });

  it("Jumat lebih awal tutup -> rentang dipecah", () => {
    const keraton = { ...all("08:30", "14:00"), fri: ["08:30", "13:00"] as [string, string] };
    expect(summarizeOpenHours(keraton)).toEqual(["Sen–Kam 08.30–14.00", "Jum 08.30–13.00", "Sab–Min 08.30–14.00"]);
  });

  it("hari tanpa kunci disebut tutup", () => {
    const museum = { ...all("08:30", "16:00") } as Record<string, [string, string]>;
    delete museum.mon;
    expect(summarizeOpenHours(museum)).toEqual(["Sel–Min 08.30–16.00", "Tutup Sen"]);
  });

  it("objek kosong -> tidak ada baris", () => {
    expect(summarizeOpenHours({})).toEqual([]);
  });
});

describe("formatWibDateTime", () => {
  it("mengubah instan UTC ke WIB", () => {
    expect(formatWibDateTime("2026-10-15T16:59:40.897Z")).toBe("15 Okt 2026, 23.59 WIB");
    expect(formatWibDateTime("2026-10-15T17:30:00Z")).toBe("16 Okt 2026, 00.30 WIB");
  });
});
