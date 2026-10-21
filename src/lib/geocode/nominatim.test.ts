import { describe, expect, it, vi } from "vitest";
import { NOMINATIM_USER_AGENT, parsePlaceHints, reverseGeocode } from "./nominatim";

// Alamat nyata dari Nominatim (21 Okt 2026) untuk titik-titik di DIY.
const DIY = { state: "Daerah Istimewa Yogyakarta", "ISO3166-2-lvl4": "ID-YO", country: "Indonesia", country_code: "id" };
const place = (address: Record<string, string>) => ({ address: { ...address, ...DIY } });

describe("parsePlaceHints", () => {
  it.each([
    [
      "desa tanpa jalan (Parangtritis)",
      place({ village: "Parangtritis", municipality: "Kretek", county: "Bantul" }),
      { kabupaten: "Bantul", address: "Desa Parangtritis, Kec. Kretek" },
    ],
    [
      "kota: kelurahan dan kecamatan (Tugu Yogyakarta)",
      place({ neighbourhood: "Kampung Cokrokusuman", suburb: "Cokrodiningratan", city_district: "Jetis", city: "Kota Yogyakarta", district: "Depok" }),
      { kabupaten: "Kota Yogyakarta", address: "Kampung Cokrokusuman, Kel. Cokrodiningratan, Kec. Jetis" },
    ],
    [
      "jalan, desa, kecamatan (Prambanan)",
      place({ amenity: "Candi Prambanan", road: "Jalan Jogja - Solo", village: "Bokoharjo", municipality: "Prambanan", county: "Sleman" }),
      { kabupaten: "Sleman", address: "Jalan Jogja - Solo, Desa Bokoharjo, Kec. Prambanan" },
    ],
    [
      "kecamatan bertanda town (Pantai Baron)",
      place({ road: "Jalan Pantai Baron", village: "Kemadang", town: "Tanjungsari", county: "Gunungkidul" }),
      { kabupaten: "Gunungkidul", address: "Jalan Pantai Baron, Desa Kemadang, Kec. Tanjungsari" },
    ],
    [
      "Kulonprogo ditulis tanpa spasi",
      place({ road: "JPO Wates", city_district: "Bendungan", city: "Wates", county: "Kulonprogo" }),
      { kabupaten: "Kulon Progo", address: "JPO Wates, Kec. Bendungan" },
    ],
    [
      "awalan Kabupaten pada county",
      place({ village: "Hargobinangun", county: "Kabupaten Sleman" }),
      { kabupaten: "Sleman", address: "Desa Hargobinangun" },
    ],
  ])("%s", (_name, body, expected) => {
    expect(parsePlaceHints(body)).toEqual(expected);
  });

  it("state 'Daerah Istimewa Yogyakarta' tidak dianggap Kota Yogyakarta", () => {
    expect(parsePlaceHints(place({ village: "Contoh" })).kabupaten).toBeNull();
  });

  it("titik di luar DIY menghasilkan saran kosong", () => {
    const outside = { address: { village: "Borobudur", county: "Magelang", state: "Jawa Tengah", "ISO3166-2-lvl4": "ID-JT" } };
    expect(parsePlaceHints(outside)).toEqual({ kabupaten: null, address: null });
  });

  it.each([
    ["galat layanan", { error: "Unable to geocode" }],
    ["tanpa address", {}],
    ["bukan objek", "ngawur"],
    ["null", null],
    ["address kosong", { address: {} }],
  ])("bentuk tak dikenal: %s -> saran kosong", (_name, body) => {
    expect(parsePlaceHints(body)).toEqual({ kabupaten: null, address: null });
  });

  it("nilai bukan string pada address diabaikan", () => {
    const body = { address: { ...DIY, village: "Kemadang", road: 123, county: "Gunungkidul" } };
    expect(parsePlaceHints(body)).toEqual({ kabupaten: "Gunungkidul", address: "Desa Kemadang" });
  });
});

describe("reverseGeocode", () => {
  const okResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it("memanggil /reverse dengan koordinat, bahasa Indonesia, dan User-Agent yang mengidentifikasi aplikasi", async () => {
    const fetchImpl = vi.fn(async () => okResponse(place({ village: "Kemadang", county: "Gunungkidul" })));
    const hints = await reverseGeocode(-8.1286, 110.5475, { baseUrl: "https://geokode.contoh/", fetchImpl });

    expect(hints.kabupaten).toBe("Gunungkidul");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/geokode\.contoh\/reverse\?/);
    expect(url).toContain("lat=-8.128600");
    expect(url).toContain("lon=110.547500");
    expect(url).toContain("accept-language=id");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(NOMINATIM_USER_AGENT);
  });

  it("HTTP non-2xx dilempar sebagai galat", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429 }));
    await expect(reverseGeocode(-7.8, 110.4, { fetchImpl })).rejects.toThrow(/429/);
  });

  it("jaringan gagal dilempar sebagai galat", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(reverseGeocode(-7.8, 110.4, { fetchImpl })).rejects.toThrow(/fetch failed/);
  });
});
