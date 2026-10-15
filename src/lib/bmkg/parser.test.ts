import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/parangtritis-34.02.03.2002.json";
import { BmkgParseError, parseBmkgResponse } from "./parser";

// Fixture adalah respons ASLI BMKG untuk Parangtritis (diambil 15 Okt 2026),
// bukan data karangan, sehingga tes ini menangkap perubahan format di sisi BMKG.

describe("parseBmkgResponse (respons asli BMKG)", () => {
  const parsed = parseBmkgResponse(fixture);

  it("membaca lokasi", () => {
    expect(parsed.location).toMatchObject({
      adm4: "34.02.03.2002",
      desa: "Parangtritis",
      kecamatan: "Kretek",
      kabupaten: "Bantul",
    });
  });

  it("meratakan 3 hari menjadi 19 slot 3 jam yang terurut", () => {
    expect(parsed.slots).toHaveLength(19);
    const times = parsed.slots.map((slot) => slot.validAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i] - times[i - 1]).toBe(3 * 60 * 60 * 1000);
    }
  });

  it("slot pertama: UTC dan WIB konsisten, nilai cuaca terbaca", () => {
    expect(parsed.slots[0]).toMatchObject({
      validAt: new Date("2026-10-15T17:00:00Z"),
      localTime: "2026-10-16T00:00:00", // UTC+7
      analysisDate: new Date("2026-10-15T12:00:00Z"),
      weatherDesc: "Cerah",
      t: 25,
      ws: 12,
      hu: 88,
      tcc: 46,
      wd: "E",
      vsText: null, // BMKG mengirim null saat cerah
    });
  });

  it("local_datetime selalu 7 jam setelah utc_datetime", () => {
    for (const slot of parsed.slots) {
      const local = new Date(`${slot.localTime}Z`).getTime();
      expect(local - slot.validAt.getTime()).toBe(7 * 60 * 60 * 1000);
    }
  });
});

describe("parseBmkgResponse (input rusak)", () => {
  it("menolak objek tanpa lokasi", () => {
    expect(() => parseBmkgResponse({ data: [] })).toThrow(BmkgParseError);
  });

  it("menolak tanggal yang tidak valid", () => {
    const bad = structuredClone(fixture) as typeof fixture;
    bad.data[0].cuaca[0][0].utc_datetime = "bukan tanggal";
    expect(() => parseBmkgResponse(bad)).toThrow(/Tanggal tidak valid/);
  });

  it("menolak nilai bukan objek", () => {
    expect(() => parseBmkgResponse(null)).toThrow(BmkgParseError);
    expect(() => parseBmkgResponse("teks")).toThrow(BmkgParseError);
  });

  it("slot ganda pada waktu yang sama digabung", () => {
    const dup = structuredClone(fixture) as typeof fixture;
    dup.data[0].cuaca[1].push(dup.data[0].cuaca[0][0]);
    expect(parseBmkgResponse(dup).slots).toHaveLength(19);
  });
});
