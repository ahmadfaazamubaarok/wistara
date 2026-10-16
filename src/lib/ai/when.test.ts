import { describe, expect, it } from "vitest";
import { daySlots, makeSlot, NOW, TODAY, TOMORROW } from "./test-helpers";
import { parseWhen, pickSlot } from "./when";

// NOW = Sabtu 17 Okt 2026, 03.07 WIB.
describe("parseWhen", () => {
  it("memahami hari, jam, dan bagian hari", () => {
    expect(parseWhen("besok siang jam 13.00 ke mana?", NOW)).toMatchObject({ dayOffset: 1, hour: 13, part: "siang" });
    expect(parseWhen("lusa pukul 8 pagi", NOW)).toMatchObject({ dayOffset: 2, hour: 8, part: "pagi" });
    expect(parseWhen("jam 4 sore", NOW)).toMatchObject({ hour: 16, part: "sore" });
    expect(parseWhen("malam ini", NOW)).toMatchObject({ dayOffset: 0, part: "malam", hour: null });
    expect(parseWhen("sunsetan", NOW)).toMatchObject({ part: "sore" });
  });

  it("tidak menyebut apa-apa = semua kosong", () => {
    expect(parseWhen("tempat sejuk", NOW)).toEqual({ dayOffset: null, hour: null, part: null, beyond: null, isNow: false });
  });

  it("memahami nama hari dan weekend", () => {
    expect(parseWhen("hari minggu enaknya ke mana", NOW).dayOffset).toBe(1);
    expect(parseWhen("weekend ini", NOW).dayOffset).toBe(0);
    expect(parseWhen("tanggal 18 oktober", NOW).dayOffset).toBe(1);
  });

  it("menandai waktu di luar jangkauan 3 hari", () => {
    expect(parseWhen("hari jumat", NOW).beyond).toContain("Jumat");
    expect(parseWhen("minggu depan", NOW).beyond).not.toBeNull();
    expect(parseWhen("kemarin", NOW).beyond).not.toBeNull();
    expect(parseWhen("5 hari lagi", NOW).beyond).not.toBeNull();
  });

  it("'sekarang' memakai jam WIB saat ini", () => {
    expect(parseWhen("sekarang hujan nggak?", NOW)).toMatchObject({ isNow: true, dayOffset: 0, hour: 3 });
  });

  it("tidak menganggap harga sebagai jam", () => {
    expect(parseWhen("tiket Rp 10.000", NOW).hour).toBeNull();
  });
});

describe("pickSlot", () => {
  const slots = [...daySlots(TODAY, [80, 70, 60, 90]), ...daySlots(TOMORROW, [null, 70, 95, 60])];

  it("jam tepat memilih slot yang memuatnya", () => {
    const pick = pickSlot(slots, TOMORROW, { hour: 13, part: "siang" }, NOW);
    expect(pick.status).toBe("ok");
    expect(pick.slot?.localTime).toContain("T12:00");
  });

  it("bagian hari memilih slot buka berskor tertinggi di rentangnya", () => {
    const pick = pickSlot(slots, TOMORROW, { hour: null, part: "pagi" }, NOW);
    expect(pick.slot?.score).toBe(70); // 06.00 tutup, 09.00 skor 70
  });

  it("tanpa preferensi memilih slot buka terbaik di hari itu", () => {
    expect(pickSlot(slots, TOMORROW, { hour: null, part: null }, NOW).slot?.score).toBe(95);
  });

  it("slot tutup dilaporkan closed, bukan dipilih", () => {
    expect(pickSlot(slots, TOMORROW, { hour: 7, part: null }, NOW).status).toBe("closed");
  });

  it("slot yang sudah berakhir dilaporkan past", () => {
    const later = new Date("2026-10-17T10:00:00Z"); // 17.00 WIB
    expect(pickSlot(slots, TODAY, { hour: 7, part: null }, later).status).toBe("past");
    expect(pickSlot(slots, TODAY, { hour: null, part: "pagi" }, later).status).toBe("past");
  });

  it("hari tanpa prakiraan = no_forecast", () => {
    expect(pickSlot(slots, "2026-10-25", { hour: null, part: null }, NOW).status).toBe("no_forecast");
    expect(makeSlot(TODAY, 6, 50).score).toBe(50);
  });
});
