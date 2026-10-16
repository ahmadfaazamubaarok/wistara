import { describe, expect, it } from "vitest";
import { CATALOG_ENTRIES } from "./test-helpers";
import { validateReply, type ValidationContext } from "./validator";

const context: ValidationContext = {
  allowedText: "Untuk besok pukul 13.00 WIB: Museum Ullen Sentalu (skor 92, Cerah, 28°C). Tiket Rp 50.000.",
  catalog: CATALOG_ENTRIES,
  allowedSlugs: ["museum-ullen-sentalu"],
};

describe("validateReply", () => {
  it("menerima kalimat yang hanya memakai angka dan nama dari fakta", () => {
    const reply = "Besok pukul 13.00 WIB, Museum Ullen Sentalu paling nyaman dengan skor 92 dan suhu 28°C.";
    expect(validateReply(reply, context)).toEqual({ ok: true });
  });

  it("menolak angka yang tidak ada di fakta (skor atau suhu karangan)", () => {
    const result = validateReply("Museum Ullen Sentalu punya skor 99 besok siang, sangat nyaman.", context);
    expect(result).toEqual({ ok: false, reason: "angka 99 tidak ada di fakta" });
  });

  it("menyamakan 06 dan 6", () => {
    const ctx = { ...context, allowedText: "buka 06.00 sampai 18.00" };
    expect(validateReply("Buka dari pukul 6 sampai pukul 18 setiap hari.", ctx).ok).toBe(true);
  });

  it("menolak menyebut destinasi lain di luar fakta", () => {
    const result = validateReply("Museum Ullen Sentalu bagus, tetapi Candi Prambanan juga layak dikunjungi.", context);
    expect(result.ok).toBe(false);
  });

  it("menolak tautan, markup, dan panjang yang tidak wajar", () => {
    expect(validateReply("Kunjungi https://contoh.test untuk info Museum Ullen Sentalu.", context).ok).toBe(false);
    expect(validateReply("<b>Museum Ullen Sentalu</b> sangat nyaman besok.", context).ok).toBe(false);
    expect(validateReply("Ya.", context).ok).toBe(false);
    expect(validateReply("Museum Ullen Sentalu nyaman. ".repeat(60), context).ok).toBe(false);
  });
});
