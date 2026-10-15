import { describe, expect, it } from "vitest";
import {
  bestOverlappingSlot,
  bestSlotPerDay,
  scoreSlots,
  upcomingSlots,
  wibDayKeys,
  type ForecastRow,
} from "./slots";

const PANTAI = { wRain: 1.0, wWind: 0.8, wHeat: 0.5, wVis: 0.3 };

// Membuat baris dari jam WIB: "2026-10-16", 15 -> validAt = 08:00 UTC.
function row(date: string, hourWib: number, overrides: Partial<ForecastRow> = {}): ForecastRow {
  const hh = String(hourWib).padStart(2, "0");
  return {
    validAt: new Date(new Date(`${date}T${hh}:00:00Z`).getTime() - 7 * 3600 * 1000),
    localTime: `${date}T${hh}:00:00`,
    t: 28, hu: 80, ws: 12, wd: "E", tcc: 40, weatherDesc: "Berawan",
    ...overrides,
  };
}

describe("scoreSlots", () => {
  it("pantai tanpa jam buka: 09.00 cerah = 100, 15.00 hujan ringan = 25, 21.00 = Tutup", () => {
    const slots = scoreSlots(
      [
        row("2026-10-16", 9),
        row("2026-10-16", 15, { weatherDesc: "Hujan Ringan", ws: 25, t: 31 }),
        row("2026-10-16", 21),
      ],
      { openHours: null },
      PANTAI,
    );

    expect(slots.map((s) => s.score)).toEqual([100, 25, null]);
    expect(slots.map((s) => s.label)).toEqual(["Sangat sesuai", "Kurang sesuai", "Tutup"]);
    expect(slots[1].reasons).toEqual(["Hujan ringan diprakirakan (-40)", "Angin 25 km/jam (-27)"]);
    expect(slots[1].dominant).toBe("rain");
    expect(slots[2]).toMatchObject({ isOpen: false, band: "closed", reasons: [], dominant: null });
  });

  it("format waktu mengikuti contoh respons API", () => {
    const [slot] = scoreSlots([row("2026-10-16", 15)], { openHours: null }, PANTAI);
    expect(slot.localTime).toBe("2026-10-16T15:00:00+07:00");
    expect(slot.validAt).toBe("2026-10-16T08:00:00.000Z");
  });

  it("slot tutup tidak dinilai walau cuacanya buruk", () => {
    const [slot] = scoreSlots(
      [row("2026-10-16", 3, { weatherDesc: "Hujan Petir" })],
      { openHours: null },
      PANTAI,
    );
    expect(slot.score).toBeNull();
  });

  it("meneruskan hook teks cuaca tidak dikenal", () => {
    const seen: string[] = [];
    scoreSlots([row("2026-10-16", 9, { weatherDesc: "Hujan Lokal" })], { openHours: null }, PANTAI, {
      onUnknownWeather: (d) => seen.push(d),
    });
    expect(seen).toEqual(["Hujan Lokal"]);
  });
});

describe("upcomingSlots", () => {
  const slots = scoreSlots(
    [row("2026-10-16", 9), row("2026-10-16", 12), row("2026-10-16", 15)],
    { openHours: null },
    PANTAI,
  );

  it("slot yang masih berjalan tetap tampil, yang sudah berakhir dibuang", () => {
    // 13.30 WIB: slot 09.00 (09-12) sudah lewat; 12.00 (12-15) masih berjalan.
    const now = new Date("2026-10-16T06:30:00Z");
    expect(upcomingSlots(slots, now).map((s) => s.localTime.slice(11, 16))).toEqual(["12:00", "15:00"]);
  });

  it("tepat saat slot berakhir, slot itu dibuang", () => {
    const now = new Date("2026-10-16T08:00:00Z"); // 15.00 WIB = akhir slot 12.00
    expect(upcomingSlots(slots, now).map((s) => s.localTime.slice(11, 16))).toEqual(["15:00"]);
  });
});

describe("wibDayKeys", () => {
  it("menghitung hari ini/besok/lusa menurut kalender WIB, bukan UTC", () => {
    // 17.30 UTC tanggal 15 = 00.30 WIB tanggal 16.
    expect(wibDayKeys(new Date("2026-10-15T17:30:00Z"))).toEqual(["2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(wibDayKeys(new Date("2026-10-15T16:59:00Z"))).toEqual(["2026-10-15", "2026-10-16", "2026-10-17"]);
  });
});

describe("bestSlotPerDay", () => {
  it("memilih skor tertinggi per tanggal, seri = paling awal, tutup diabaikan", () => {
    const slots = scoreSlots(
      [
        row("2026-10-16", 6, { weatherDesc: "Berawan Tebal" }), // 90
        row("2026-10-16", 9), // 100
        row("2026-10-16", 12), // 100 (seri, kalah karena lebih akhir)
        row("2026-10-16", 15, { weatherDesc: "Hujan Ringan" }), // 60
        row("2026-10-17", 3), // tutup
        row("2026-10-17", 9, { weatherDesc: "Hujan Sedang" }), // 30
      ],
      { openHours: null },
      PANTAI,
    );
    const best = bestSlotPerDay(slots);
    expect(best.get("2026-10-16")?.localTime).toBe("2026-10-16T09:00:00+07:00");
    expect(best.get("2026-10-16")?.score).toBe(100);
    expect(best.get("2026-10-17")?.score).toBe(30);
  });

  it("hari yang semua slotnya tutup tidak punya slot terbaik", () => {
    const slots = scoreSlots([row("2026-10-17", 3), row("2026-10-17", 21)], { openHours: null }, PANTAI);
    expect(bestSlotPerDay(slots).has("2026-10-17")).toBe(false);
  });
});

describe("bestOverlappingSlot (grid jam BMKG bergeser antar-wilayah)", () => {
  const at = (iso: string) => ({ validAt: new Date(iso).toISOString() });
  // Pada data nyata: sebagian wilayah berjam 00,03,06 (WIB) dan sebagian lain 01,04,07.
  const samePhase = ["2026-10-17T00:00:00Z", "2026-10-17T03:00:00Z", "2026-10-17T06:00:00Z"].map(at);
  const lateByOneHour = ["2026-10-17T01:00:00Z", "2026-10-17T04:00:00Z", "2026-10-17T07:00:00Z"].map(at);
  const earlyByOneHour = ["2026-10-17T02:00:00Z", "2026-10-17T05:00:00Z", "2026-10-17T08:00:00Z"].map(at);
  const trigger = new Date("2026-10-17T03:00:00Z").getTime(); // slot 03:00-06:00 UTC

  it("fase sama: slot yang persis sama", () => {
    expect(bestOverlappingSlot(samePhase, trigger)?.validAt).toBe("2026-10-17T03:00:00.000Z");
  });

  it("kandidat mulai 1 jam lebih LAMBAT: pilih slot dengan irisan 2 jam", () => {
    // 01-04 beririsan 1 jam, 04-07 beririsan 2 jam
    expect(bestOverlappingSlot(lateByOneHour, trigger)?.validAt).toBe("2026-10-17T04:00:00.000Z");
  });

  it("kandidat mulai 1 jam lebih AWAL: pilih slot dengan irisan 2 jam", () => {
    // 02-05 beririsan 2 jam, 05-08 beririsan 1 jam
    expect(bestOverlappingSlot(earlyByOneHour, trigger)?.validAt).toBe("2026-10-17T02:00:00.000Z");
  });

  it("tanpa irisan memadai -> undefined (tidak memaksakan pasangan)", () => {
    expect(bestOverlappingSlot([at("2026-10-17T12:00:00Z")], trigger)).toBeUndefined();
    // irisan hanya 1 jam (< setengah slot) juga ditolak
    expect(bestOverlappingSlot([at("2026-10-17T05:00:00Z")], trigger)).toBeUndefined();
  });

  it("daftar kosong -> undefined", () => {
    expect(bestOverlappingSlot([], trigger)).toBeUndefined();
  });
});
