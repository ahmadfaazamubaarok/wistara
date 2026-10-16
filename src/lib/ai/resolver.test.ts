import { describe, expect, it } from "vitest";
import { closestNames, findMentions, findUnknownPlaces } from "./resolver";
import { CATALOG_ENTRIES as catalog } from "./test-helpers";

const slugsOf = (text: string) => findMentions(text, catalog).map((m) => m.slug);

describe("findMentions", () => {
  it("mengenali nama tanpa kata umum ('desa tembi' = Desa Wisata Tembi)", () => {
    expect(slugsOf("desa tembi buka jam berapa")).toEqual(["desa-wisata-tembi"]);
  });

  it("mengenali alias dan ejaan tidak baku", () => {
    expect(slugsOf("kraton jogja")).toEqual(["keraton-yogyakarta"]);
    expect(slugsOf("ke ulen sentalu")).toEqual(["museum-ullen-sentalu"]);
    expect(slugsOf("sono budoyo")).toEqual(["museum-sonobudoyo"]);
  });

  it("memaafkan salah ketik ringan", () => {
    expect(slugsOf("prambanann buka?")).toEqual(["candi-prambanan"]);
    expect(slugsOf("pantai parangtritiss")).toEqual(["pantai-parangtritis"]);
  });

  it("mengurutkan menurut kemunculan dan menemukan beberapa destinasi", () => {
    expect(slugsOf("lebih bagus ratu boko atau prambanan?")).toEqual(["candi-ratu-boko", "candi-prambanan"]);
  });

  it("tidak mencocokkan kata umum atau nama daerah saja", () => {
    expect(slugsOf("pantai")).toEqual([]);
    expect(slugsOf("candi yang bagus")).toEqual([]);
    expect(slugsOf("wisata di Yogyakarta")).toEqual([]);
    expect(slugsOf("keluarga di jogja")).toEqual([]);
  });
});

describe("findUnknownPlaces", () => {
  const unknown = (text: string) => findUnknownPlaces(text, findMentions(text, catalog), catalog);

  it("mengenali tempat terkenal di luar katalog", () => {
    expect(unknown("ke Borobudur sore ini")).toEqual(["Borobudur"]);
    expect(unknown("Malioboro jam berapa tutup")).toEqual(["Malioboro"]);
  });

  it("mengenali 'pantai X' yang tidak ada di katalog", () => {
    expect(unknown("pantai kukup bagus nggak")).toEqual(["Pantai Kukup"]);
  });

  it("tidak salah menandai kata biasa atau destinasi katalog", () => {
    expect(unknown("pantai selatan yang cerah")).toEqual([]);
    expect(unknown("pantai parangtritis sore ini")).toEqual([]);
    expect(unknown("candi prambanan atau museum sonobudoyo")).toEqual([]);
  });
});

describe("closestNames", () => {
  it("menyarankan nama yang mirip", () => {
    expect(closestNames("tembe", catalog)[0].slug).toBe("desa-wisata-tembi");
  });
});
