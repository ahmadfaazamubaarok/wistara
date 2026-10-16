import { describe, expect, it } from "vitest";
import { getAllEnrichedTags, getDestinationEnrichment } from "./destination-enrichment";
import curated from "../../supabase/seed/destinations.curated.json";

describe("destination-enrichment", () => {
  it("seluruh 20 destinasi terkurasi memiliki metadata pengayaan yang lengkap", () => {
    expect(curated).toHaveLength(20);
    for (const d of curated) {
      const enrichment = getDestinationEnrichment(d.slug);
      expect(enrichment, `Destinasi ${d.slug} harus memiliki pengayaan`).toBeDefined();
      expect(enrichment?.ticketPrice.domestic.length).toBeGreaterThan(0);
      expect(enrichment?.highlights.length).toBeGreaterThanOrEqual(2);
      expect(enrichment?.tips.length).toBeGreaterThanOrEqual(2);
      expect(enrichment?.tags.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("getAllEnrichedTags mengembalikan daftar tag unik", () => {
    const tags = getAllEnrichedTags();
    expect(tags.length).toBeGreaterThan(10);
    expect(tags).toContain("Sunset");
    expect(tags).toContain("Spot Foto");
  });
});
