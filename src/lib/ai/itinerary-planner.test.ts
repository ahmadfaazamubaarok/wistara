import { describe, expect, it } from "vitest";
import type { ScoredSlot } from "../forecast/slots";
import {
  estimateTransitMinutes,
  haversineDistanceKm,
  planItinerary,
  type PlannerDestinationItem,
} from "./itinerary-planner";

function makeSlot(dateStr: string, hour: number, score: number, temp = 28, weather = "Cerah Berawan"): ScoredSlot {
  const hourPad = hour.toString().padStart(2, "0");
  const localTime = `${dateStr}T${hourPad}:00:00`;
  return {
    validAt: `${localTime}Z`,
    localTime: `${localTime}+07:00`,
    isOpen: true,
    score,
    band: "good",
    label: "Sangat sesuai",
    weatherDesc: weather,
    t: temp,
    ws: 10,
    hu: 70,
    wd: "S",
    tcc: 30,
    reasons: ["Kondisi cuaca baik"],
    dominant: null,
  };
}

describe("itinerary planner (deterministik)", () => {
  const dateKey = "2026-10-17";

  it("menghitung jarak haversine dan estimasi waktu tempuh secara proporsional", () => {
    // Malioboro/Keraton ke Prambanan ~15 km
    const dist = haversineDistanceKm(-7.8052, 110.3642, -7.752, 110.4914);
    expect(dist).toBeGreaterThan(14);
    expect(dist).toBeLessThan(18);

    // Waktu tempuh 15 km dengan kecepatan 30 km/jam dan faktor belokan 1.4 ~ 40 menit
    const minutes = estimateTransitMinutes(dist);
    expect(minutes).toBeGreaterThan(35);
    expect(minutes).toBeLessThan(55);
  });

  it("menghasilkan 3 slot berbeda (pagi, siang, sore) dengan destinasi unik", () => {
    const mockDestinations: PlannerDestinationItem[] = [
      {
        slug: "candi-prambanan",
        name: "Candi Prambanan",
        category: "budaya",
        lat: -7.752,
        lon: 110.4914,
        kabupaten: "Sleman",
        slots: [
          makeSlot(dateKey, 9, 88),
          makeSlot(dateKey, 12, 70),
          makeSlot(dateKey, 15, 75),
        ],
      },
      {
        slug: "museum-sonobudoyo",
        name: "Museum Sonobudoyo",
        category: "museum",
        lat: -7.8023,
        lon: 110.3643,
        kabupaten: "Kota Yogyakarta",
        isIndoor: true,
        slots: [
          makeSlot(dateKey, 9, 80),
          makeSlot(dateKey, 12, 92, 34), // Sangat bagus di siang hari panas
          makeSlot(dateKey, 15, 80),
        ],
      },
      {
        slug: "pantai-parangtritis",
        name: "Pantai Parangtritis",
        category: "pantai",
        lat: -8.0255,
        lon: 110.3306,
        kabupaten: "Bantul",
        slots: [
          makeSlot(dateKey, 9, 75),
          makeSlot(dateKey, 12, 60),
          makeSlot(dateKey, 15, 90), // Spot sunset sore
        ],
      },
    ];

    const result = planItinerary(mockDestinations, dateKey, { dayLabel: "Sabtu" });
    expect(result).not.toBeNull();
    expect(result?.slots).toHaveLength(3);

    const [pagi, siang, sore] = result!.slots;

    // Pastikan 3 destinasi unik
    const slugs = new Set([pagi.destination.slug, siang.destination.slug, sore.destination.slug]);
    expect(slugs.size).toBe(3);

    // Slot pagi, siang, dan sore memiliki label bagian yang benar
    expect(pagi.part).toBe("pagi");
    expect(siang.part).toBe("siang");
    expect(sore.part).toBe("sore");

    // Siang panas (34°C) memilih Sonobudoyo (indoor)
    expect(siang.destination.slug).toBe("museum-sonobudoyo");

    // Sore sunset memilih Parangtritis
    expect(sore.destination.slug).toBe("pantai-parangtritis");
  });

  it("mendiskualifikasi destinasi yang memiliki peringatan dini (CAP warning) aktif", () => {
    const mockDestinations: PlannerDestinationItem[] = [
      {
        slug: "candi-prambanan",
        name: "Candi Prambanan",
        category: "budaya",
        lat: -7.752,
        lon: 110.4914,
        kabupaten: "Sleman",
        hasWarning: true, // Ada cuaca ekstrem aktif!
        slots: [
          makeSlot(dateKey, 9, 95),
          makeSlot(dateKey, 12, 95),
          makeSlot(dateKey, 15, 95),
        ],
      },
      {
        slug: "hutan-pinus-mangunan",
        name: "Hutan Pinus Mangunan",
        category: "alam",
        lat: -7.9366,
        lon: 110.4285,
        kabupaten: "Bantul",
        slots: [
          makeSlot(dateKey, 9, 85),
          makeSlot(dateKey, 12, 85),
          makeSlot(dateKey, 15, 85),
        ],
      },
      {
        slug: "museum-sonobudoyo",
        name: "Museum Sonobudoyo",
        category: "museum",
        lat: -7.8023,
        lon: 110.3643,
        kabupaten: "Kota Yogyakarta",
        isIndoor: true,
        slots: [
          makeSlot(dateKey, 9, 82),
          makeSlot(dateKey, 12, 90),
          makeSlot(dateKey, 15, 82),
        ],
      },
      {
        slug: "pantai-parangtritis",
        name: "Pantai Parangtritis",
        category: "pantai",
        lat: -8.0255,
        lon: 110.3306,
        kabupaten: "Bantul",
        slots: [
          makeSlot(dateKey, 9, 80),
          makeSlot(dateKey, 12, 80),
          makeSlot(dateKey, 15, 90),
        ],
      },
    ];

    const result = planItinerary(mockDestinations, dateKey);
    expect(result).not.toBeNull();

    // Prambanan tidak boleh terpilih karena hasWarning = true
    const usedSlugs = result!.slots.map((s) => s.destination.slug);
    expect(usedSlugs).not.toContain("candi-prambanan");

    // Muncul catatan mengenai eliminasi
    expect(result!.notices.some((n) => n.includes("Candi Prambanan"))).toBe(true);
  });
});
