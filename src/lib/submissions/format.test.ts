import { describe, expect, it } from "vitest";
import { buildOpenHours } from "./schema";
import { summarizeOpenHours } from "./format";

describe("summarizeOpenHours", () => {
  it("null = tanpa batas jam, menyebut jendela bawaan", () => {
    expect(summarizeOpenHours(null)).toBe("Tanpa batas jam (jendela bawaan 06:00–18:00)");
  });

  it("jam sama setiap hari", () => {
    expect(summarizeOpenHours(buildOpenHours("08:00", "17:00", []))).toBe("08:00–17:00, setiap hari");
  });

  it("jam sama dengan hari tutup", () => {
    expect(summarizeOpenHours(buildOpenHours("08:00", "17:00", ["mon", "tue"]))).toBe("08:00–17:00, tutup Senin, Selasa");
  });

  it("jam berbeda antarhari dirinci per hari", () => {
    expect(summarizeOpenHours({ mon: ["08:00", "12:00"], tue: ["09:00", "17:00"] })).toBe("Senin 08:00–12:00; Selasa 09:00–17:00");
  });

  it("tanpa satu pun hari buka", () => {
    expect(summarizeOpenHours({})).toBe("Tutup setiap hari");
  });
});
