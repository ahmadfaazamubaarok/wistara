import { describe, expect, it } from "vitest";
import { buildOpenHours, fieldErrorsFrom, normalizeWhatsapp, rawFromFormData, submissionSchema } from "./schema";
import { slugify } from "./slug";

const valid = {
  name: "Pantai Contoh Baru",
  category: "pantai",
  isIndoor: false,
  lat: "-8.1286",
  lon: "110.5475",
  kabupaten: "Gunungkidul",
  address: "Dusun Contoh, Desa Kanigoro, Saptosari",
  openTime: "08:00",
  closeTime: "17:00",
  closedDays: [] as string[],
  description: "",
  managerName: "Pokdarwis Contoh",
  managerRole: "pengelola",
  contactWa: "0812-3456-7890",
  evidenceUrl: "",
  consent: true,
};

const parse = (overrides: Record<string, unknown> = {}) => submissionSchema.safeParse({ ...valid, ...overrides });
const errorsOf = (overrides: Record<string, unknown>) => {
  const result = parse(overrides);
  expect(result.success).toBe(false);
  return result.success ? {} : fieldErrorsFrom(result.error);
};

describe("normalizeWhatsapp", () => {
  it.each([
    ["081234567890", "6281234567890"],
    ["0812-3456-7890", "6281234567890"],
    ["+62 812 3456 7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    ["(0812) 3456.7890", "6281234567890"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeWhatsapp(input)).toBe(expected);
  });

  it.each(["", "abc", "12345", "0274 123456", "+1 415 555 0100", "0712345678", "08123", "62812345678901234"])(
    "%j ditolak",
    (input) => {
      expect(normalizeWhatsapp(input)).toBeNull();
    },
  );
});

describe("buildOpenHours", () => {
  it("memakai jam yang sama untuk hari yang buka dan membuang hari tutup", () => {
    const hours = buildOpenHours("08:00", "16:00", ["mon"]);
    expect(hours.mon).toBeUndefined();
    expect(hours.tue).toEqual(["08:00", "16:00"]);
    expect(Object.keys(hours)).toHaveLength(6);
  });
});

describe("submissionSchema", () => {
  it("menormalkan isian yang valid", () => {
    const result = parse({ name: "  Pantai   Contoh  Baru ", lat: "-8,1286" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      name: "Pantai Contoh Baru",
      lat: -8.1286,
      lon: 110.5475,
      contactWa: "6281234567890",
      description: null,
      evidenceUrl: null,
    });
    expect(Object.keys(result.data.openHours ?? {})).toHaveLength(7);
  });

  it("tanpa jam buka: openHours null (jendela kunjungan bawaan dipakai)", () => {
    const result = parse({ openTime: "", closeTime: "" });
    expect(result.success && result.data.openHours).toBeNull();
  });

  it("hari tutup tidak masuk openHours", () => {
    const result = parse({ closedDays: ["mon", "sun"] });
    expect(result.success).toBe(true);
    if (result.success) expect(Object.keys(result.data.openHours ?? {})).toEqual(["tue", "wed", "thu", "fri", "sat"]);
  });

  it("lokasi di luar DIY ditolak di server", () => {
    // Candi Borobudur, Jawa Tengah.
    expect(errorsOf({ lat: "-7.6079", lon: "110.2038" }).lat).toMatch(/luar Daerah Istimewa Yogyakarta/);
  });

  it("koordinat kosong atau bukan angka diminta memilih lokasi", () => {
    expect(errorsOf({ lat: "", lon: "" }).lat).toMatch(/Pilih lokasi/);
    expect(errorsOf({ lat: "abc" }).lat).toMatch(/Pilih lokasi/);
    expect(errorsOf({ lat: undefined }).lat).toMatch(/Pilih lokasi/);
  });

  it("koordinat di luar rentang bumi ditolak", () => {
    expect(errorsOf({ lat: "-95" }).lat).toMatch(/luar jangkauan/);
  });

  it("jam buka dan tutup harus berpasangan dan berurutan", () => {
    expect(errorsOf({ closeTime: "" }).closeTime).toMatch(/sekaligus/);
    expect(errorsOf({ openTime: "", closeTime: "17:00" }).openTime).toMatch(/sekaligus/);
    expect(errorsOf({ openTime: "17:00", closeTime: "08:00" }).closeTime).toMatch(/setelah jam buka/);
    expect(errorsOf({ openTime: "8.00" }).openTime).toMatch(/HH:MM/);
  });

  it("tidak boleh menandai semua hari tutup", () => {
    expect(errorsOf({ closedDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] }).closedDays).toMatch(/satu hari/);
  });

  it("persetujuan wajib dicentang", () => {
    expect(errorsOf({ consent: false }).consent).toMatch(/persetujuan/i);
  });

  it("nomor WhatsApp yang tidak valid ditolak dengan contoh", () => {
    expect(errorsOf({ contactWa: "0274 123456" }).contactWa).toMatch(/Contoh/);
  });

  it("kategori, kabupaten, dan hubungan harus dari daftar", () => {
    const errors = errorsOf({ category: "mall", kabupaten: "Magelang", managerRole: "turis" });
    expect(Object.keys(errors).sort()).toEqual(["category", "kabupaten", "managerRole"]);
  });

  it("nama terlalu pendek, terlalu panjang, atau memuat karakter kontrol ditolak", () => {
    expect(errorsOf({ name: "ab" }).name).toMatch(/minimal 3/);
    expect(errorsOf({ name: "x".repeat(81) }).name).toMatch(/maksimal 80/);
    expect(errorsOf({ name: "Pantai\u0000Baron" }).name).toMatch(/tidak valid/);
  });

  it("tautan bukti hanya http(s)", () => {
    expect(parse({ evidenceUrl: "https://contoh.id/profil" }).success).toBe(true);
    expect(errorsOf({ evidenceUrl: "javascript:alert(1)" }).evidenceUrl).toMatch(/http/);
    expect(errorsOf({ evidenceUrl: "ftp://contoh.id/x" }).evidenceUrl).toMatch(/http/);
  });

  it("kolom yang tidak dikenal ditolak (strict)", () => {
    expect(parse({ status: "disetujui" }).success).toBe(false);
  });
});

describe("rawFromFormData", () => {
  it("memetakan FormData termasuk kotak centang dan hari tutup", () => {
    const form = new FormData();
    form.set("name", "Pantai Contoh");
    form.set("lat", "-8.1");
    form.set("consent", "on");
    form.set("isIndoor", "on");
    form.append("closedDays", "mon");
    form.append("closedDays", "tue");
    expect(rawFromFormData(form)).toMatchObject({
      name: "Pantai Contoh",
      lat: "-8.1",
      consent: true,
      isIndoor: true,
      closedDays: ["mon", "tue"],
      description: undefined,
    });
  });

  it("kotak centang yang tidak dicentang bernilai false", () => {
    const raw = rawFromFormData(new FormData());
    expect(raw).toMatchObject({ consent: false, isIndoor: false, closedDays: [] });
  });
});

describe("slugify", () => {
  it.each([
    ["Pantai Baron", "pantai-baron"],
    ["  Ngobaran!!  ", "ngobaran"],
    ["Taman Sári — Kraton Yogyakarta", "taman-sari-kraton-yogyakarta"],
    ["Goa Pindul 2", "goa-pindul-2"],
    ["?!", "destinasi"],
  ])("%j -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("dipotong 80 karakter tanpa tanda hubung di ujung", () => {
    const slug = slugify(`${"a".repeat(79)} bbbb`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toMatch(/^[a-z0-9-]{1,80}$/);
  });
});
