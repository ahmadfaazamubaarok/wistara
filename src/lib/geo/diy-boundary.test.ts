import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isInsideDiy } from "./diy-boundary";

describe("isInsideDiy", () => {
  it.each([
    ["Tugu Yogyakarta", -7.7828, 110.3671],
    ["Candi Prambanan", -7.752, 110.4915],
    ["Pantai Parangtritis", -8.0245, 110.3314],
    ["Kaliurang (Sleman utara)", -7.6, 110.43],
  ])("%s berada di DIY", (_name, lat, lon) => {
    expect(isInsideDiy(lat, lon)).toBe(true);
  });

  it.each([
    ["Candi Borobudur (Magelang, Jawa Tengah)", -7.6079, 110.2038],
    ["Kota Surakarta", -7.5666, 110.8167],
    ["Semarang", -6.9667, 110.4167],
    ["Samudra Hindia di selatan DIY", -9.5, 110.4],
    ["Pacitan, Jawa Timur", -8.2, 111.1],
  ])("%s berada di luar DIY", (_name, lat, lon) => {
    expect(isInsideDiy(lat, lon)).toBe(false);
  });

  it("koordinat bukan angka ditolak", () => {
    expect(isInsideDiy(Number.NaN, 110.37)).toBe(false);
    expect(isInsideDiy(-7.8, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("seluruh destinasi seed berada di dalam poligon (data dan poligon konsisten)", () => {
    const seed = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "supabase/seed/destinations.json"), "utf8"),
    ) as { slug: string; lat: number; lon: number }[];
    const outside = seed.filter((d) => !isInsideDiy(d.lat, d.lon)).map((d) => d.slug);
    expect(outside).toEqual([]);
  });
});
