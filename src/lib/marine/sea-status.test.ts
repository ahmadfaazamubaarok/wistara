import { describe, expect, it } from "vitest";
import { evaluateSeaSlot, seaRecommendationRank, type MarinePointInput, type SeaStatus } from "./sea-status";

describe("seaRecommendationRank", () => {
  it("hanya status bahaya yang didorong ke bawah", () => {
    expect(seaRecommendationRank("bahaya")).toBe(1);
    for (const s of ["perhatian", "waspada", "informasi_terbatas", null, undefined] as const) {
      expect(seaRecommendationRank(s)).toBe(0);
    }
  });

  it("pantai bahaya berskor tinggi tidak mengalahkan destinasi lain yang skornya lebih rendah", () => {
    const picks: { name: string; score: number; seaStatus: SeaStatus | null }[] = [
      { name: "Pantai Bahaya", score: 95, seaStatus: "bahaya" },
      { name: "Candi", score: 80, seaStatus: null },
      { name: "Pantai Waspada", score: 70, seaStatus: "waspada" },
    ];
    const sorted = [...picks].sort(
      (a, b) => seaRecommendationRank(a.seaStatus) - seaRecommendationRank(b.seaStatus) || b.score - a.score,
    );
    expect(sorted.map((p) => p.name)).toEqual(["Candi", "Pantai Waspada", "Pantai Bahaya"]);
  });
});

describe("evaluateSeaSlot", () => {
  const baseSlot = "2026-10-18T00:00:00Z";
  const defaultOpts = { isStale: false, marineAreaCode: "P.N.03" };

  it("satu slot berisi tiga titik per jam dengan Rendah, Sedang, Rendah menghasilkan waspada", () => {
    const points: MarinePointInput[] = [
      {
        validAt: "2026-10-18T00:00:00Z",
        resolutionMinutes: 60,
        waveCat: "Rendah",
        waveHeight: 0.8,
        windGustKt: 10,
        currentSpeedKt: 0.5,
      },
      {
        validAt: "2026-10-18T01:00:00Z",
        resolutionMinutes: 60,
        waveCat: "Sedang",
        waveHeight: 1.5,
        windGustKt: 12,
        currentSpeedKt: 0.7,
      },
      {
        validAt: "2026-10-18T02:00:00Z",
        resolutionMinutes: 60,
        waveCat: "Rendah",
        waveHeight: 0.9,
        windGustKt: 11,
        currentSpeedKt: 0.6,
      },
    ];

    const result = evaluateSeaSlot(baseSlot, points, defaultOpts);
    expect(result.status).toBe("waspada");
    expect(result.pointCount).toBe(3);
    expect(result.waveHeightMax).toBe(1.5);
  });

  it("satu titik Tinggi menghasilkan bahaya", () => {
    const points: MarinePointInput[] = [
      {
        validAt: "2026-10-18T00:00:00Z",
        resolutionMinutes: 180,
        waveCat: "Tinggi",
        waveHeight: 2.8,
        windGustKt: 15,
        currentSpeedKt: 1.2,
      },
    ];

    const result = evaluateSeaSlot(baseSlot, points, defaultOpts);
    expect(result.status).toBe("bahaya");
    expect(result.waveHeightMax).toBe(2.8);
  });

  it("Sedang dengan hembusan 26 knot menghasilkan eskalasi ke bahaya", () => {
    const points: MarinePointInput[] = [
      {
        validAt: "2026-10-18T00:00:00Z",
        resolutionMinutes: 180,
        waveCat: "Sedang",
        waveHeight: 1.8,
        windGustKt: 26, // > 25 knot -> eskalasi
        currentSpeedKt: 1.0,
      },
    ];

    const result = evaluateSeaSlot(baseSlot, points, defaultOpts);
    expect(result.status).toBe("bahaya");
  });

  it("Rendah dengan hembusan 26 knot menghasilkan eskalasi ke waspada", () => {
    const points: MarinePointInput[] = [
      {
        validAt: "2026-10-18T00:00:00Z",
        resolutionMinutes: 180,
        waveCat: "Rendah",
        waveHeight: 0.7,
        windGustKt: 26,
        currentSpeedKt: 0.5,
      },
    ];

    const result = evaluateSeaSlot(baseSlot, points, defaultOpts);
    expect(result.status).toBe("waspada");
  });

  it("slot yang beririsan dengan titik resolusi 180 yang dimulai 1 jam lebih awal tetap mendapat titik itu", () => {
    // Slot mulai pukul 01:00 UTC sampai 04:00 UTC
    const offsetSlot = "2026-10-18T01:00:00Z";
    // Titik maritim resolusi 180 mulai pukul 00:00 UTC sampai 03:00 UTC
    const points: MarinePointInput[] = [
      {
        validAt: "2026-10-18T00:00:00Z",
        resolutionMinutes: 180,
        waveCat: "Sedang",
        waveHeight: 1.7,
        windGustKt: 10,
        currentSpeedKt: 0.8,
      },
    ];

    const result = evaluateSeaSlot(offsetSlot, points, defaultOpts);
    expect(result.pointCount).toBe(1);
    expect(result.status).toBe("waspada");
  });

  it("data basi menghasilkan informasi_terbatas walau isinya Tenang", () => {
    const points: MarinePointInput[] = [
      {
        validAt: "2026-10-18T00:00:00Z",
        resolutionMinutes: 60,
        waveCat: "Tenang",
        waveHeight: 0.3,
        windGustKt: 5,
        currentSpeedKt: 0.2,
      },
    ];

    const result = evaluateSeaSlot(baseSlot, points, { isStale: true, marineAreaCode: "P.N.03" });
    expect(result.status).toBe("informasi_terbatas");
  });

  it("pantai tanpa marineAreaCode menghasilkan informasi_terbatas", () => {
    const points: MarinePointInput[] = [
      {
        validAt: "2026-10-18T00:00:00Z",
        resolutionMinutes: 60,
        waveCat: "Rendah",
        waveHeight: 0.5,
        windGustKt: 5,
        currentSpeedKt: 0.2,
      },
    ];

    const result = evaluateSeaSlot(baseSlot, points, { isStale: false, marineAreaCode: null });
    expect(result.status).toBe("informasi_terbatas");
  });

  it("ATURAN KERAS: tidak ada keluaran yang bernilai 'aman'", () => {
    const testCases: MarinePointInput[][] = [
      [
        {
          validAt: "2026-10-18T00:00:00Z",
          resolutionMinutes: 60,
          waveCat: "Tenang",
          waveHeight: 0.1,
          windGustKt: 2,
          currentSpeedKt: 0.1,
        },
      ],
      [
        {
          validAt: "2026-10-18T00:00:00Z",
          resolutionMinutes: 60,
          waveCat: "Rendah",
          waveHeight: 0.5,
          windGustKt: 4,
          currentSpeedKt: 0.2,
        },
      ],
    ];

    for (const pts of testCases) {
      const res = evaluateSeaSlot(baseSlot, pts, defaultOpts);
      expect((res.status as string)).not.toBe("aman");
      expect(res.status).toBe("perhatian");
    }
  });

  it("evaluasi berdasarkan waveHeight jika waveCat kosong", () => {
    const points: MarinePointInput[] = [
      {
        validAt: "2026-10-18T00:00:00Z",
        resolutionMinutes: 60,
        waveCat: null,
        waveHeight: 2.6, // >= 2.5 m -> bahaya
        windGustKt: 10,
        currentSpeedKt: 0.8,
      },
    ];

    const result = evaluateSeaSlot(baseSlot, points, defaultOpts);
    expect(result.status).toBe("bahaya");
  });

  it("kategori yang dilaporkan milik titik terburuk, bukan titik yang lebih ringan", () => {
    const points: MarinePointInput[] = [
      { validAt: "2026-10-18T00:00:00Z", resolutionMinutes: 60, waveCat: "Rendah", waveHeight: 1.0, windGustKt: 10, currentSpeedKt: 0.5 },
      { validAt: "2026-10-18T01:00:00Z", resolutionMinutes: 60, waveCat: null, waveHeight: 2.7, windGustKt: 10, currentSpeedKt: 0.5 },
    ];
    const result = evaluateSeaSlot(baseSlot, points, defaultOpts);
    expect(result.status).toBe("bahaya");
    expect(result.waveCat).toBeNull();
    expect(result.waveHeightMax).toBe(2.7);
  });
});
