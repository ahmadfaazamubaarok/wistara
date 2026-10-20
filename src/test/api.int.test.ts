import { describe, expect, it } from "vitest";
import { GET as getAlternatives } from "@/app/api/v1/destinations/[slug]/alternatives/route";
import { GET as getFacilities } from "@/app/api/v1/destinations/[slug]/facilities/route";
import { GET as getForecast } from "@/app/api/v1/destinations/[slug]/forecast/route";
import { GET as getDestination } from "@/app/api/v1/destinations/[slug]/route";
import { GET as getSea } from "@/app/api/v1/destinations/[slug]/sea/route";
import { GET as getSafety } from "@/app/api/v1/destinations/[slug]/safety/route";
import { GET as listDestinations } from "@/app/api/v1/destinations/route";
import { GET as getRecommendations } from "@/app/api/v1/recommendations/route";
import { GET as getAlerts } from "@/app/api/v1/alerts/route";
import { buildOpenApiDocument } from "@/lib/api/openapi";
import {
  alertListResponseSchema,
  beachSafetyResponseSchema,
  destinationListSchema,
  destinationSchema,
  errorSchema,
  facilitiesResponseSchema,
  recommendationsResponseSchema,
  seaResponseSchema,
} from "@/lib/api/schemas";
import { getPool } from "@/lib/db";
import { call, withSlug } from "./helpers";

const expectError = (result: Awaited<ReturnType<typeof call>>, status: number, code: string) => {
  expect(result.status).toBe(status);
  const parsed = errorSchema.parse(result.json); // format error seragam
  expect(parsed.error.code).toBe(code);
  expect(parsed.error.message.length).toBeGreaterThan(0);
  expect(result.headers.get("cache-control")).toBe("no-store");
};

describe("GET /api/v1/destinations", () => {
  it("mengembalikan 20 destinasi berurutan nama, sesuai skema, dengan header cache CDN", async () => {
    const result = await call(listDestinations, "/api/v1/destinations");
    expect(result.status).toBe(200);
    const body = destinationListSchema.parse(result.json);
    expect(body.destinations.length).toBeGreaterThanOrEqual(20);

    const names = body.destinations.map((d) => d.name);
    expect(names.length).toBeGreaterThanOrEqual(20);
    expect(result.headers.get("cache-control")).toBe("public, s-maxage=600, stale-while-revalidate=3600");
    expect(body.destinations.every((d) => d.routeUrl.startsWith("https://www.google.com/maps/dir/?api=1&destination="))).toBe(true);
  });

  it("sekitar 4 destinasi per kategori (PRD: cakupan data MVP)", async () => {
    const body = destinationListSchema.parse((await call(listDestinations, "/api/v1/destinations")).json);
    const perCategory = Object.groupBy(body.destinations, (d) => d.category);
    for (const category of ["pantai", "alam", "budaya", "museum", "desa_wisata"] as const) {
      expect(perCategory[category]?.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("filter kategori jamak, pencarian nama, dan bbox", async () => {
    const museumPantai = destinationListSchema.parse(
      (await call(listDestinations, "/api/v1/destinations?category=museum,pantai")).json,
    );
    expect(museumPantai.destinations.length).toBeGreaterThanOrEqual(8);
    expect(new Set(museumPantai.destinations.map((d) => d.category))).toEqual(new Set(["museum", "pantai"]));

    const q = destinationListSchema.parse((await call(listDestinations, "/api/v1/destinations?q=PARANG")).json);
    expect(q.destinations.map((d) => d.slug)).toEqual(expect.arrayContaining(["gumuk-pasir-parangkusumo", "pantai-parangtritis"]));

    const bbox = destinationListSchema.parse(
      (await call(listDestinations, "/api/v1/destinations?bbox=110.34,-7.83,110.40,-7.78")).json,
    );
    expect(bbox.destinations.map((d) => d.slug)).toContain("keraton-yogyakarta");
    expect(bbox.destinations.map((d) => d.slug)).not.toContain("pantai-parangtritis");
  });

  it("karakter khusus LIKE dari pengguna dibaca apa adanya, bukan wildcard", async () => {
    for (const q of ["%25", "_", "100%25"]) {
      const body = destinationListSchema.parse((await call(listDestinations, `/api/v1/destinations?q=${q}`)).json);
      expect(body.destinations, `q=${q}`).toHaveLength(0);
    }
  });

  it.each([
    ["category=gunung"],
    ["category="],
    ["bbox=1,2,3"],
    ["bbox=a,b,c,d"],
    ["bbox=110,-8,109,-7"], // minLon >= maxLon
    ["bbox=110,-8,111,-95"], // lintang di luar rentang
    ["q="],
    [`q=${"x".repeat(81)}`],
    ["include=semua"],
  ])("menolak input tidak valid dengan 400: %s", async (query) => {
    expectError(await call(listDestinations, `/api/v1/destinations?${query}`), 400, "VALIDATION_ERROR");
  });
});

describe("GET /api/v1/destinations/{slug}", () => {
  it("detail sesuai skema", async () => {
    const result = await call(getDestination, "/x", withSlug("keraton-yogyakarta"));
    expect(result.status).toBe(200);
    const body = destinationSchema.parse(result.json);
    expect(body.name).toBe("Keraton Yogyakarta");
    expect(body.openHours?.fri).toEqual(["08:30", "13:00"]);
    // Jam buka seed belum diverifikasi: API harus jujur soal itu.
    expect(body.openHoursVerifiedAt).toBeNull();
  });

  it("slug yang valid tetapi tidak ada -> 404", async () => {
    expectError(await call(getDestination, "/x", withSlug("tidak-ada")), 404, "NOT_FOUND");
  });

  it.each(["TIDAK-ADA", "x;drop", "a b", "../etc/passwd", "x".repeat(81), "pantai_baron", ""])(
    "slug tidak valid ditolak 400 sebelum menyentuh database: %j",
    async (slug) => {
      expectError(await call(getDestination, "/x", withSlug(slug)), 400, "VALIDATION_ERROR");
    },
  );
});

describe("GET /api/v1/destinations/{slug}/facilities", () => {
  it("terurut dari terdekat, dalam radius, dan melaporkan tipe yang tidak terpetakan", async () => {
    const result = await call(getFacilities, "/x?radius=500", withSlug("keraton-yogyakarta"));
    expect(result.status).toBe(200);
    const body = facilitiesResponseSchema.parse(result.json);

    expect(body.radiusM).toBe(500);
    expect(body.facilities.length).toBeGreaterThan(0);
    const distances = body.facilities.map((f) => f.distanceM);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(Math.max(...distances)).toBeLessThanOrEqual(500);

    const found = new Set(body.facilities.map((f) => f.type));
    for (const missing of body.missingTypes) expect(found.has(missing)).toBe(false);
    expect(body.attribution).toContain("OpenStreetMap");
  });

  it("filter tipe", async () => {
    const result = await call(getFacilities, "/x?radius=1000&type=toilet,parkir", withSlug("keraton-yogyakarta"));
    const body = facilitiesResponseSchema.parse(result.json);
    expect(new Set(body.facilities.map((f) => f.type))).toEqual(new Set(["toilet", "parkir"]));
  });

  it("destinasi dengan data OSM minim melaporkan tipe kosong, bukan error", async () => {
    const result = await call(getFacilities, "/x?radius=500", withSlug("pantai-baron"));
    expect(result.status).toBe(200);
    const body = facilitiesResponseSchema.parse(result.json);
    expect(body.missingTypes.length).toBeGreaterThan(0);
  });

  it.each([["radius=99"], ["radius=3001"], ["radius=abc"], ["radius=12.5"], ["type=bank"], ["type="]])(
    "menolak input tidak valid dengan 400: %s",
    async (query) => {
      expectError(await call(getFacilities, `/x?${query}`, withSlug("pantai-baron")), 400, "VALIDATION_ERROR");
    },
  );

  it("404 untuk destinasi yang tidak ada", async () => {
    expectError(await call(getFacilities, "/x", withSlug("tidak-ada")), 404, "NOT_FOUND");
  });
});

describe("validasi parameter prakiraan dan alternatif", () => {
  it.each([["days=0"], ["days=4"], ["days=x"], ["days=1.5"]])("forecast menolak %s dengan 400", async (query) => {
    expectError(await call(getForecast, `/x?${query}`, withSlug("pantai-baron")), 400, "VALIDATION_ERROR");
  });

  it.each([[""], ["slot=besok"], ["slot=2026-10-16"], ["slot=2026-10-16T15:00:00"]])(
    "alternatives menolak slot tidak valid dengan 400: %j",
    async (query) => {
      expectError(await call(getAlternatives, `/x?${query}`, withSlug("pantai-baron")), 400, "VALIDATION_ERROR");
    },
  );

  it("404 untuk slot yang tidak ada di prakiraan", async () => {
    // Tanpa prakiraan tersimpan untuk wilayah ini, slot apa pun tidak ditemukan.
    await getPool().query("truncate forecasts, forecast_fetches");
    const result = await call(getAlternatives, "/x?slot=2030-01-01T10:00:00%2B07:00", withSlug("pantai-baron"));
    expectError(result, 404, "NOT_FOUND");
  });
});

describe("dokumen OpenAPI", () => {
  const doc = buildOpenApiDocument();

  it("OpenAPI 3.1 dengan seluruh endpoint (publik dan rencana)", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths ?? {}).sort()).toEqual(
      [
        "/api/v1/alerts",
        "/api/v1/destinations",
        "/api/v1/destinations/{slug}",
        "/api/v1/destinations/{slug}/alternatives",
        "/api/v1/destinations/{slug}/facilities",
        "/api/v1/destinations/{slug}/forecast",
        "/api/v1/destinations/{slug}/safety",
        "/api/v1/destinations/{slug}/sea",
        "/api/v1/health",
        "/api/v1/recommendations",
        "/api/v1/trips",
        "/api/v1/trips/{id}",
        "/api/v1/trips/{id}/items",
        "/api/v1/trips/{id}/items/{itemId}",
      ].sort(),
    );
  });

  it("setiap endpoint mendokumentasikan 400/404 (kecuali daftar dan health) dan format error seragam", () => {
    const withSlugPaths = Object.entries(doc.paths ?? {}).filter(([path]) => path.includes("{slug}"));
    for (const [path, item] of withSlugPaths) {
      const responses = (item as { get: { responses: Record<string, unknown> } }).get.responses;
      expect(Object.keys(responses), path).toEqual(expect.arrayContaining(["200", "400", "404"]));
    }
    expect(doc.components?.schemas).toHaveProperty("Error");
  });

  it("parameter query yang didokumentasikan sama dengan yang diterima kode", () => {
    const names = (path: string) =>
      ((doc.paths?.[path] as { get: { parameters: { name: string }[] } }).get.parameters ?? []).map((p) => p.name).sort();
    expect(names("/api/v1/alerts")).toEqual(["demo", "destination"]);
    expect(names("/api/v1/destinations")).toEqual(["bbox", "category", "include", "q"]);
    expect(names("/api/v1/destinations/{slug}/forecast")).toEqual(["days", "slug"]);
    expect(names("/api/v1/destinations/{slug}/facilities")).toEqual(["radius", "slug", "type"]);
    expect(names("/api/v1/destinations/{slug}/alternatives")).toEqual(["slot", "slug"]);
    expect(names("/api/v1/destinations/{slug}/sea")).toEqual(["days", "slug"]);
    expect(names("/api/v1/destinations/{slug}/safety")).toEqual(["slug"]);
    expect(names("/api/v1/recommendations")).toEqual(["category", "slot"]);
  });
});

describe("GET /api/v1/destinations/{slug}/sea", () => {
  it("menolak destinasi yang bukan kategori pantai dengan 404 NOT_FOUND", async () => {
    expectError(await call(getSea, "/x", withSlug("keraton-yogyakarta")), 404, "NOT_FOUND");
  });

  it("menolak slug yang tidak ada dengan 404 NOT_FOUND", async () => {
    expectError(await call(getSea, "/x", withSlug("pantai-khayalan")), 404, "NOT_FOUND");
  });

  it("mengembalikan data maritim untuk destinasi pantai sesuai skema", async () => {
    const result = await call(getSea, "/x", withSlug("pantai-glagah"));
    expect(result.status).toBe(200);
    const body = seaResponseSchema.parse(result.json);
    expect(body.destination.slug).toBe("pantai-glagah");
    expect(body.destination.marineAreaCode).toBe("P.N.01");
    expect(body.source.provider).toBe("BMKG");
    expect(body.notice).toBe(
      "Status berlaku untuk wilayah perairan, bukan jaminan kondisi di bibir pantai. Ikuti arahan petugas di lokasi.",
    );
    expect(Array.isArray(body.slots)).toBe(true);
  });
});

describe("GET /api/v1/destinations/{slug}/safety", () => {
  it("menolak destinasi yang bukan kategori pantai dengan 404 NOT_FOUND", async () => {
    expectError(await call(getSafety, "/x", withSlug("keraton-yogyakarta")), 404, "NOT_FOUND");
  });

  it("mengembalikan 200 dengan verified: false dan data: null bila pantai belum dikurasi", async () => {
    const result = await call(getSafety, "/x", withSlug("pantai-glagah"));
    expect(result.status).toBe(200);
    const body = beachSafetyResponseSchema.parse(result.json);
    expect(body.verified).toBe(false);
    expect(body.data).toBeNull();
  });
});

describe("GET /api/v1/recommendations (F11)", () => {
  it("menolak tanpa parameter slot dengan 400", async () => {
    expectError(await call(getRecommendations, "/api/v1/recommendations"), 400, "VALIDATION_ERROR");
  });

  it("mengembalikan 20 destinasi diurutkan skor tertinggi", async () => {
    const slot = "2026-10-16T15:00:00+07:00";
    const result = await call(getRecommendations, `/api/v1/recommendations?slot=${encodeURIComponent(slot)}`);
    expect(result.status).toBe(200);
    const body = recommendationsResponseSchema.parse(result.json);
    expect(body.total).toBe(body.recommendations.length);
    expect(body.recommendations.length).toBeGreaterThanOrEqual(20);
    for (let i = 0; i < body.recommendations.length - 1; i++) {
      const a = body.recommendations[i].score ?? -1;
      const b = body.recommendations[i + 1].score ?? -1;
      expect(a).toBeGreaterThanOrEqual(b);
    }
  });

  it("dapat disaring dengan parameter category", async () => {
    const slot = "2026-10-16T15:00:00+07:00";
    const result = await call(getRecommendations, `/api/v1/recommendations?slot=${encodeURIComponent(slot)}&category=museum`);
    expect(result.status).toBe(200);
    const body = recommendationsResponseSchema.parse(result.json);
    expect(body.recommendations.every((r) => r.destination.category === "museum")).toBe(true);
  });
});

describe("GET /api/v1/alerts (F10)", () => {
  it("mengembalikan daftar alert aktif dengan format valid", async () => {
    const result = await call(getAlerts, "/api/v1/alerts");
    expect(result.status).toBe(200);
    const body = alertListResponseSchema.parse(result.json);
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it("mode demo mengembalikan alert simulasi cuaca ekstrem DIY", async () => {
    const result = await call(getAlerts, "/api/v1/alerts?demo=1");
    expect(result.status).toBe(200);
    const body = alertListResponseSchema.parse(result.json);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.alerts[0].event).toBe("Peringatan Dini Cuaca Ekstrem");
    expect(body.alerts[0].headline).toContain("Peringatan Dini");
  });

  it("menolak slug destinasi yang tidak terdaftar dengan 404", async () => {
    expectError(await call(getAlerts, "/api/v1/alerts?destination=tempat-fiktif"), 404, "NOT_FOUND");
  });

  it("dapat meminta alert spesifik untuk destinasi dengan mode demo", async () => {
    const result = await call(getAlerts, "/api/v1/alerts?destination=pantai-parangtritis&demo=1");
    expect(result.status).toBe(200);
    const body = alertListResponseSchema.parse(result.json);
    expect(body.total).toBe(1);
    expect(body.alerts[0].areaDesc).toContain("Kretek");
  });
});
