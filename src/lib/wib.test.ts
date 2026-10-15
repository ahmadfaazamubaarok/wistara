import { describe, expect, it } from "vitest";
import { formatWibTime, getWibDateKey } from "./wib";

describe("formatWibTime", () => {
  it("mengubah UTC ke WIB (UTC+7)", () => {
    expect(formatWibTime(new Date("2026-10-15T08:00:00Z"))).toBe("15.00");
  });

  it("tengah malam WIB tampil 00.00, bukan 24.00", () => {
    expect(formatWibTime(new Date("2026-10-15T17:00:00Z"))).toBe("00.00");
  });

  it("menjaga menit", () => {
    expect(formatWibTime(new Date("2026-10-15T23:05:00Z"))).toBe("06.05");
  });
});

describe("getWibDateKey", () => {
  it("tanggal WIB sudah maju sehari saat UTC masih di hari sebelumnya", () => {
    expect(getWibDateKey(new Date("2026-10-15T17:30:00Z"))).toBe("2026-10-16");
  });

  it("sebelum pukul 00.00 WIB masih di hari yang sama", () => {
    expect(getWibDateKey(new Date("2026-10-15T16:59:00Z"))).toBe("2026-10-15");
  });
});
