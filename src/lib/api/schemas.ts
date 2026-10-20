// Skema validasi input (query/params) dan bentuk respons API v1.
// Skema yang sama dipakai untuk: (1) menolak input tidak valid dengan 400,
// (2) menghasilkan dokumen OpenAPI di /api/openapi.json, dan (3) tes yang
// memastikan respons nyata sesuai dokumen.

import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { DEST_CATEGORIES, FACILITY_TYPES } from "../categories";

extendZodWithOpenApi(z);

/* ------------------------------ input ------------------------------ */

const SLUG_MESSAGE = "hanya boleh huruf kecil, angka, dan tanda hubung (maksimal 80 karakter)";
export const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/, SLUG_MESSAGE) });

function csvOf<const T extends readonly [string, ...string[]]>(values: T, field: string) {
  return z
    .string()
    .transform((value) => value.split(",").map((part) => part.trim()).filter(Boolean))
    .pipe(
      z
        .array(z.enum(values, { error: `${field} harus salah satu dari: ${values.join(", ")}` }))
        .min(1, `${field} tidak boleh kosong`)
        .max(values.length),
    );
}

const bboxSchema = z.string().transform((value, ctx) => {
  const parts = value.split(",").map(Number);
  const message = "bbox harus berformat minLon,minLat,maxLon,maxLat (derajat desimal, min < maks)";
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90 || minLon >= maxLon || minLat >= maxLat) {
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  }
  return [minLon, minLat, maxLon, maxLat] as [number, number, number, number];
});

export const destinationsQuery = z.object({
  category: csvOf(DEST_CATEGORIES, "category").optional(),
  q: z.string().trim().min(1, "q tidak boleh kosong").max(80, "q maksimal 80 karakter").optional(),
  bbox: bboxSchema.optional(),
  include: z.enum(["scores"], { error: "include hanya mendukung: scores" }).optional(),
});

export const forecastQuery = z.object({
  days: z.coerce
    .number({ error: "days harus berupa angka" })
    .int("days harus bilangan bulat")
    .min(1, "days minimal 1")
    .max(3, "days maksimal 3")
    .default(3),
});

export const facilitiesQuery = z.object({
  radius: z.coerce
    .number({ error: "radius harus berupa angka (meter)" })
    .int("radius harus bilangan bulat")
    .min(100, "radius minimal 100 meter")
    .max(3000, "radius maksimal 3000 meter")
    .default(1000),
  type: csvOf(FACILITY_TYPES, "type").optional(),
});

export const alternativesQuery = z.object({
  slot: z
    .string({ error: "slot wajib diisi (ISO 8601, mis. 2026-10-16T15:00:00+07:00)" })
    .pipe(z.iso.datetime({ offset: true, error: "slot harus berformat ISO 8601, mis. 2026-10-16T15:00:00+07:00" }))
    .transform((value) => new Date(value)),
});

export const recommendationsQuery = z.object({
  slot: z
    .string({ error: "slot wajib diisi (ISO 8601, mis. 2026-10-16T15:00:00+07:00)" })
    .pipe(z.iso.datetime({ offset: true, error: "slot harus berformat ISO 8601, mis. 2026-10-16T15:00:00+07:00" }))
    .transform((value) => new Date(value)),
  category: csvOf(DEST_CATEGORIES, "category").optional(),
});

export const alertsQuery = z.object({
  destination: z.string().regex(/^[a-z0-9-]{1,80}$/, SLUG_MESSAGE).optional(),
  demo: z.enum(["1", "true"]).optional(),
});

/* ----------------------------- respons ----------------------------- */

const categoryEnum = z.enum(DEST_CATEGORIES);
const bandEnum = z.enum(["good", "mid", "bad", "closed"]);
const labelEnum = z.enum(["Sangat sesuai", "Cukup sesuai", "Kurang sesuai", "Tutup", "Tidak ada prakiraan"]);
const penaltyEnum = z.enum(["rain", "wind", "heat", "vis"]);

export const sourceSchema = z
  .object({
    provider: z.literal("BMKG"),
    analysisDate: z.string().nullable().openapi({ description: "Waktu produksi prakiraan oleh BMKG (UTC)." }),
    fetchedAt: z.string().nullable().openapi({ description: "Terakhir kali server berhasil mengambil dari BMKG." }),
    isStale: z.boolean().openapi({ description: "True bila keberhasilan terakhir lebih dari 13 jam lalu." }),
  })
  .openapi("Source");

export const slotSchema = z
  .object({
    localTime: z.string().openapi({ example: "2026-10-16T15:00:00+07:00", description: "Awal slot 3 jam (WIB)." }),
    validAt: z.string().openapi({ description: "Awal slot dalam UTC." }),
    weatherDesc: z.string().nullable(),
    t: z.number().nullable().openapi({ description: "Suhu, °C." }),
    ws: z.number().nullable().openapi({ description: "Kecepatan angin, km/jam." }),
    hu: z.number().nullable().openapi({ description: "Kelembapan, %." }),
    wd: z.string().nullable(),
    tcc: z.number().nullable(),
    isOpen: z.boolean(),
    score: z.number().int().min(0).max(100).nullable().openapi({ description: "null bila slot di luar jam buka." }),
    band: bandEnum,
    label: labelEnum,
    reasons: z.array(z.string()).max(3).openapi({ example: ["Hujan ringan diprakirakan (-40)"] }),
    dominantPenalty: penaltyEnum.nullable(),
    hasAlternatives: z.boolean().openapi({ description: "True bila ada destinasi indoor alternatif untuk slot ini." }),
  })
  .openapi("ForecastSlot");

export const bestOfDaySchema = z
  .object({ date: z.string(), localTime: z.string(), score: z.number().int(), label: labelEnum, band: bandEnum })
  .openapi("BestOfDay");

export const destinationSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    category: categoryEnum,
    isIndoor: z.boolean(),
    lat: z.number(),
    lon: z.number(),
    region: z.object({ desa: z.string(), kecamatan: z.string(), kabupaten: z.string() }),
    description: z.string().nullable(),
    openHours: z
      .record(z.string(), z.tuple([z.string(), z.string()]))
      .nullable()
      .openapi({ description: "Hari tanpa kunci = tutup. null = tanpa batas jam (jendela kunjungan 06.00-18.00 dipakai untuk skor)." }),
    openHoursVerifiedAt: z.string().nullable().openapi({ description: "null = jam buka belum diverifikasi ke pengelola." }),
    routeUrl: z.url().openapi({ description: "Tautan rute Google Maps (tanpa API key)." }),
  })
  .openapi("Destination");

export const destinationListItemSchema = destinationSchema
  .extend({ bestByDay: z.array(bestOfDaySchema.nullable()).optional() })
  .openapi("DestinationListItem");

export const destinationListSchema = z
  .object({
    destinations: z.array(destinationListItemSchema),
    days: z.array(z.string()).optional().openapi({ description: "Tanggal WIB untuk Hari ini, Besok, Lusa (hanya dengan include=scores)." }),
    source: sourceSchema.optional(),
  })
  .openapi("DestinationList");

export const forecastResponseSchema = z
  .object({
    destination: z.object({ slug: z.string(), category: categoryEnum }),
    source: sourceSchema,
    slots: z.array(slotSchema),
    bestByDay: z.array(bestOfDaySchema),
  })
  .openapi("ForecastResponse");

export const facilitySchema = z
  .object({
    id: z.number().int(),
    type: z.enum(FACILITY_TYPES),
    name: z.string().nullable().openapi({ description: "null = tanpa nama di OSM." }),
    lat: z.number(),
    lon: z.number(),
    distanceM: z.number().int(),
  })
  .openapi("Facility");

export const facilitiesResponseSchema = z
  .object({
    destination: z.object({ slug: z.string() }),
    radiusM: z.number().int(),
    facilities: z.array(facilitySchema).openapi({ description: "Diurutkan dari yang terdekat." }),
    missingTypes: z.array(z.enum(FACILITY_TYPES)).openapi({ description: "Tipe yang diminta tetapi belum terpetakan di OSM dalam radius ini." }),
    attribution: z.string(),
  })
  .openapi("FacilitiesResponse");

export const alternativeSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    category: categoryEnum,
    distanceM: z.number().int(),
    score: z.number().int(),
    label: labelEnum,
    band: bandEnum,
  })
  .openapi("Alternative");

export const alternativesResponseSchema = z
  .object({
    destination: z.object({ slug: z.string() }),
    slot: slotSchema,
    triggered: z.boolean().openapi({ description: "True bila skor slot < 50 dan penalti terbesarnya hujan." }),
    alternatives: z.array(alternativeSchema).max(3),
    otherSlot: slotSchema.nullable().openapi({ description: "Bila tidak ada alternatif: slot lain di destinasi yang sama dengan skor tertinggi." }),
  })
  .openapi("AlternativesResponse");

export const healthResponseSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    checkedAt: z.object({ utc: z.string(), wib: z.string() }),
    database: z.union([z.object({ status: z.literal("up"), latencyMs: z.number() }), z.object({ status: z.literal("down") })]),
    bmkg: z
      .object({
        regions: z.number().int(),
        staleRegions: z.number().int().openapi({ description: "Wilayah yang belum pernah berhasil atau terakhir berhasil > 13 jam lalu." }),
        lastSuccessAt: z.string().nullable(),
        oldestSuccessAt: z.string().nullable(),
      })
      .nullable(),
    marine: z
      .object({
        areas: z.number().int(),
        staleAreas: z.number().int().openapi({ description: "Wilayah maritim yang belum pernah berhasil atau terakhir berhasil > 24 jam lalu." }),
        lastSuccessAt: z.string().nullable(),
        oldestSuccessAt: z.string().nullable(),
      })
      .nullable()
      .optional(),
  })
  .openapi("Health");

export const errorSchema = z
  .object({
    error: z.object({
      code: z.enum(["VALIDATION_ERROR", "UNAUTHORIZED", "NOT_FOUND", "RATE_LIMITED", "UPSTREAM_UNAVAILABLE", "INTERNAL_ERROR"]),
      message: z.string(),
    }),
  })
  .openapi("Error");

/* --------------------------- rencana kunjungan --------------------------- */

export const tripIdParams = z.object({ id: z.uuid({ error: "id harus berupa UUID" }) });
export const tripItemParams = z.object({
  id: z.uuid({ error: "id harus berupa UUID" }),
  itemId: z.uuid({ error: "itemId harus berupa UUID" }),
});

// .strict(): kolom yang tidak dikenal ditolak (salah ketik tidak boleh diabaikan diam-diam).
export const tripBody = z
  .object({
    title: z
      .string({ error: "title wajib diisi" })
      .trim()
      .min(1, "title tidak boleh kosong")
      .max(80, "title maksimal 80 karakter"),
  })
  .strict();

export const addItemBody = z
  .object({
    destinationId: z.uuid({ error: "destinationId harus berupa UUID" }),
    plannedSlot: z.iso
      .datetime({ offset: true, error: "plannedSlot harus berformat ISO 8601, mis. 2026-10-16T15:00:00+07:00" })
      .nullable()
      .optional(),
  })
  .strict();

export const tripItemSchema = z
  .object({
    id: z.string(),
    destination: z.object({ id: z.string(), slug: z.string(), name: z.string(), category: categoryEnum }),
    plannedSlot: z.string().nullable().openapi({ description: "Awal slot 3 jam (UTC); null = belum memilih slot." }),
    position: z.number().int(),
  })
  .openapi("TripItem");

export const tripSchema = z
  .object({
    id: z.string(),
    title: z.string().min(1).max(80),
    createdAt: z.string(),
    items: z.array(tripItemSchema),
  })
  .openapi("Trip");

export const tripListSchema = z.object({ trips: z.array(tripSchema) }).openapi("TripList");

export const addedItemSchema = z
  .object({
    id: z.string(),
    created: z.boolean().openapi({ description: "false bila item yang sama sudah ada (permintaan bersifat idempoten)." }),
  })
  .openapi("AddedItem");

export const recommendationItemSchema = z
  .object({
    destination: z.object({
      slug: z.string(),
      name: z.string(),
      category: categoryEnum,
      isIndoor: z.boolean(),
      kabupaten: z.string(),
    }),
    isOpen: z.boolean(),
    score: z.number().int().min(0).max(100).nullable(),
    band: bandEnum,
    label: labelEnum,
    weatherDesc: z.string().nullable(),
    t: z.number().nullable(),
    reasons: z.array(z.string()).max(3),
  })
  .openapi("RecommendationItem");

export const recommendationsResponseSchema = z
  .object({
    slot: z.string().openapi({ description: "Slot waktu dalam UTC." }),
    localTime: z.string().openapi({ description: "Slot waktu dalam WIB." }),
    total: z.number().int(),
    recommendations: z.array(recommendationItemSchema),
  })
  .openapi("RecommendationsResponse");

export const alertSchema = z
  .object({
    capId: z.string(),
    identifier: z.string(),
    event: z.string(),
    headline: z.string().nullable(),
    description: z.string(),
    instruction: z.string().nullable(),
    severity: z.string().nullable(),
    urgency: z.string().nullable(),
    effective: z.string().openapi({ description: "Mulai berlaku (ISO 8601)." }),
    expires: z.string().openapi({ description: "Berakhir (ISO 8601)." }),
    areaDesc: z.string(),
    admKecamatan: z.array(z.string()),
  })
  .openapi("WeatherAlert");

export const alertListResponseSchema = z
  .object({
    total: z.number().int(),
    alerts: z.array(alertSchema),
  })
  .openapi("WeatherAlertList");

/* ------------------------------ maritim & keselamatan pantai ------------------------------ */

export const seaStatusEnum = z.enum(["perhatian", "waspada", "bahaya", "informasi_terbatas"]);

export const seaSlotSchema = z
  .object({
    validAt: z.string().openapi({ description: "Awal slot dalam UTC (ISO 8601).", example: "2026-10-19T02:00:00Z" }),
    localTime: z.string().openapi({ description: "Awal slot dalam WIB.", example: "2026-10-19T09:00:00+07:00" }),
    status: seaStatusEnum.openapi({ description: "Status kelayakan laut per slot." }),
    waveCat: z.string().nullable().openapi({ example: "Tinggi" }),
    waveHeightMax: z.number().nullable().openapi({ description: "Tinggi gelombang maksimum dalam meter.", example: 2.5 }),
    windGustMaxKmh: z.number().nullable().openapi({ description: "Hembusan angin maksimum dalam km/jam.", example: 37 }),
    currentSpeedMaxKmh: z.number().nullable().openapi({ description: "Kecepatan arus maksimum dalam km/jam.", example: 1.7 }),
    pointCount: z.number().int().openapi({ description: "Jumlah titik maritim beririsan.", example: 1 }),
  })
  .openapi("SeaSlot");

export const seaResponseSchema = z
  .object({
    destination: z.object({
      slug: z.string().openapi({ example: "pantai-baron" }),
      marineAreaCode: z.string().nullable().openapi({ example: "P.N.03" }),
    }),
    source: z.object({
      provider: z.literal("BMKG"),
      areaName: z.string().nullable().openapi({ example: "Perairan Gunungkidul" }),
      stationName: z.string().nullable().openapi({ example: "STASIUN METEOROLOGI KELAS II YOGYAKARTA" }),
      issuedAt: z.string().nullable().openapi({ example: "2026-10-17T12:00:00Z" }),
      fetchedAt: z.string().nullable().openapi({ example: "2026-10-18T00:05:00Z" }),
      isStale: z.boolean(),
    }),
    notice: z.string().openapi({
      example: "Status berlaku untuk wilayah perairan, bukan jaminan kondisi di bibir pantai. Ikuti arahan petugas di lokasi.",
    }),
    slots: z.array(seaSlotSchema),
  })
  .openapi("SeaResponse");

export const beachSafetyDataSchema = z
  .object({
    swimStatus: z.enum(["dilarang", "zona_terbatas", "belum_diverifikasi"]),
    hazards: z.array(z.string()),
    sarPostName: z.string().nullable(),
    sarPostLocation: z.object({ lat: z.number(), lon: z.number() }).nullable(),
    guardHours: z.record(z.string(), z.array(z.string())).nullable(),
    emergencyContact: z.string().nullable(),
    notes: z.string().nullable(),
    incidentRefs: z.array(z.unknown()),
    sourceUrl: z.string(),
    verifiedAt: z.string(),
  })
  .openapi("BeachSafetyData");

export const beachSafetyResponseSchema = z
  .object({
    destination: z.object({
      slug: z.string().openapi({ example: "pantai-baron" }),
    }),
    verified: z.boolean(),
    data: beachSafetyDataSchema.nullable(),
  })
  .openapi("BeachSafetyResponse");



