import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  capPolygonsToWkt,
  extractKecamatanNames,
  parseCapXml,
  parseSinglePolygonRing,
} from "./cap-parser";

const FIXTURE_DIY_PATH = join(__dirname, "__fixtures__", "alert-diy.xml");
const FIXTURE_REAL_PATH = join(__dirname, "__fixtures__", "alert-bmkg-real.xml");

describe("parseCapXml - Fixture DIY", () => {
  const xml = readFileSync(FIXTURE_DIY_PATH, "utf-8");

  it("berhasil mem-parse CAP XML BMKG yang valid", () => {
    const alert = parseCapXml(xml);

    expect(alert.identifier).toBe("BMKG-20261016-DIY-001");
    expect(alert.event).toBe("Peringatan Dini Cuaca Ekstrem");
    expect(alert.severity).toBe("Severe");
    expect(alert.headline).toContain("Peringatan Dini Cuaca DIY");
    expect(alert.description).toContain("Kabupaten Bantul: Kretek, Sanden");
    expect(alert.instruction).toContain("Masyarakat dihimbau agar tetap waspada");
    expect(alert.effective.toISOString()).toBe("2026-10-16T07:30:00.000Z");
    expect(alert.expires.toISOString()).toBe("2026-10-16T11:00:00.000Z");
    expect(alert.polygonWkt).toContain("POLYGON((110.25 -7.98");
  });

  it("mengekstrak daftar kecamatan terdampak dari pola titik dua", () => {
    const alert = parseCapXml(xml);
    expect(alert.admKecamatan).toContain("Kretek");
    expect(alert.admKecamatan).toContain("Sanden");
    expect(alert.admKecamatan).toContain("Tepus");
    expect(alert.admKecamatan).toContain("Ngaglik");
    expect(alert.admKecamatan).toContain("Kraton");
  });

  it("melempar error bila identifier tidak ada", () => {
    expect(() => parseCapXml("<alert><info><event>Uji</event></info></alert>")).toThrow(
      "tag <identifier> tidak ditemukan",
    );
  });

  it("melempar error bila description tidak ada", () => {
    expect(() => parseCapXml("<alert><identifier>ID-1</identifier></alert>")).toThrow(
      "tag <description> tidak ditemukan",
    );
  });
});

describe("parseCapXml - Fixture Real BMKG Nowcast", () => {
  const xml = readFileSync(FIXTURE_REAL_PATH, "utf-8");

  it("berhasil mem-parse CAP XML asli dari BMKG dengan 31 poligon", () => {
    const alert = parseCapXml(xml);

    expect(alert.identifier).toBe("2.49.0.1.360.0.2026.10.15.21.21.006");
    expect(alert.event).toBe("Hujan Lebat dan Petir");
    expect(alert.msgType).toBe("Alert");
    expect(alert.status).toBe("Actual");
    expect(alert.headline).toBe("Hujan Lebat disertai Petir di Kep. Riau");
    expect(alert.effective.toISOString()).toBe("2026-10-15T20:43:00.000Z"); // 03:43 WIB
    expect(alert.expires.toISOString()).toBe("2026-10-15T23:30:00.000Z"); // 06:30 WIB
    expect(alert.polygonWkt).toMatch(/^MULTIPOLYGON\(\(\(/);
    expect(alert.admKecamatan).toContain("Tambelan");
    // Tidak boleh mengandung potongan kalimat acak sebagai kecamatan
    expect(alert.admKecamatan).not.toContain("Hujan");
    expect(alert.admKecamatan).not.toContain("Lebat");
    expect(alert.admKecamatan).not.toContain("Petir");
  });
});

describe("extractKecamatanNames", () => {
  it("mengekstrak nama kecamatan dari teks multi-kabupaten bertanda titik dua", () => {
    const text = "Kabupaten Bantul: Kretek, Sanden; Kabupaten Sleman: Depok, Ngaglik";
    const names = extractKecamatanNames(text);
    expect(names).toEqual(expect.arrayContaining(["Kretek", "Sanden", "Depok", "Ngaglik"]));
  });

  it("mengekstrak nama kecamatan dari pola 'khususnya di ...'", () => {
    const text = "Hujan lebat terjadi di Kalteng, khususnya di KATINGAN HILIR, KATINGAN TENGAH, PERMATA INTAN. Kondisi berpotensi banjir.";
    const names = extractKecamatanNames(text);
    expect(names).toEqual(["Katingan Hilir", "Katingan Tengah", "Permata Intan"]);
  });

  it("tidak memasukkan kalimat umum tanpa penanda wilayah sebagai nama kecamatan", () => {
    const text = "Hujan lebat disertai petir dan angin kencang berpotensi terjadi di sebagian wilayah DIY. Masyarakat dihimbau waspada.";
    const names = extractKecamatanNames(text);
    expect(names).toHaveLength(0);
  });
});

describe("capPolygonsToWkt", () => {
  it("mengonversi 1 poligon menjadi WKT POLYGON((lon lat, ...))", () => {
    const raw = "-7.9,110.2 -7.8,110.4 -8.0,110.3 -7.9,110.2";
    const wkt = capPolygonsToWkt([raw]);
    expect(wkt).toBe("POLYGON((110.2 -7.9, 110.4 -7.8, 110.3 -8, 110.2 -7.9))");
  });

  it("mengonversi beberapa poligon menjadi WKT MULTIPOLYGON(((...)), ((...)))", () => {
    const p1 = "-7.9,110.2 -7.8,110.4 -8.0,110.3 -7.9,110.2";
    const p2 = "-7.5,110.1 -7.4,110.2 -7.5,110.3 -7.5,110.1";
    const wkt = capPolygonsToWkt([p1, p2]);
    expect(wkt).toBe(
      "MULTIPOLYGON(((110.2 -7.9, 110.4 -7.8, 110.3 -8, 110.2 -7.9)), ((110.1 -7.5, 110.2 -7.4, 110.3 -7.5, 110.1 -7.5)))",
    );
  });

  it("menutup poligon otomatis bila titik awal dan akhir tidak sama", () => {
    const raw = "-7.9,110.2 -7.8,110.4 -8.0,110.3";
    const ring = parseSinglePolygonRing(raw);
    expect(ring).toBe("(110.2 -7.9, 110.4 -7.8, 110.3 -8, 110.2 -7.9)");
  });

  it("mengembalikan null bila pasangan koordinat kurang dari 3", () => {
    expect(parseSinglePolygonRing("-7.9,110.2 -7.8,110.4")).toBeNull();
    expect(capPolygonsToWkt(["-7.9,110.2 -7.8,110.4"])).toBeNull();
  });
});
