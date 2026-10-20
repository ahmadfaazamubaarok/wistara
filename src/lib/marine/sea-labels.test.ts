import { describe, expect, it } from "vitest";
import { SEA_FIXED_NOTICE, SEA_STATUS_HINT, seaAriaLabel, seaBadgeFullText } from "./sea-labels";
import type { SeaStatus } from "./sea-status";

const STATUSES: SeaStatus[] = ["perhatian", "waspada", "bahaya", "informasi_terbatas"];

describe("sea-labels", () => {
  it("status terendah hanya menyebut data", () => {
    expect(seaBadgeFullText("perhatian", "Rendah", 1.1)).toBe("Gelombang rendah · 1,1 m");
    expect(seaBadgeFullText("perhatian", "Tenang", 0.4)).toBe("Gelombang tenang · 0,4 m");
  });

  it("waspada dan bahaya memakai kata perintah dan kategori BMKG", () => {
    expect(seaBadgeFullText("waspada", "Sedang", 1.9)).toBe("Waspada · gelombang sedang 1,9 m");
    expect(seaBadgeFullText("bahaya", "Tinggi", 2.6)).toBe("Bahaya · gelombang tinggi 2,6 m");
    // Eskalasi angin: status Waspada walau kategorinya Rendah
    expect(seaBadgeFullText("waspada", "Rendah", 1.1)).toBe("Waspada · gelombang rendah 1,1 m");
  });

  it("tanpa data tidak menampilkan angka", () => {
    expect(seaBadgeFullText("informasi_terbatas", "Rendah", 1.0)).toBe("Data laut belum tersedia");
  });

  it("tidak pernah memakai kata aman", () => {
    const texts = [
      SEA_FIXED_NOTICE,
      ...STATUSES.map((s) => SEA_STATUS_HINT[s]),
      ...STATUSES.flatMap((s) => [seaBadgeFullText(s, "Rendah", 1), seaAriaLabel(s, "Tinggi", 3)]),
    ];
    for (const text of texts) expect(text.toLowerCase()).not.toMatch(/\baman\b/);
  });
});
