// Dokumen OpenAPI 3.1 dibangun dari skema Zod yang SAMA dengan yang dipakai
// untuk validasi dan respons, sehingga dokumentasi tidak bisa melenceng dari
// perilaku nyata. Tes di openapi.test.ts menjaga kesesuaiannya.

import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  addedItemSchema,
  addItemBody,
  alertListResponseSchema,
  alternativesResponseSchema,
  destinationListSchema,
  destinationSchema,
  errorSchema,
  facilitiesResponseSchema,
  forecastResponseSchema,
  healthResponseSchema,
  recommendationsResponseSchema,
  tripBody,
  tripListSchema,
  tripSchema,
} from "./schemas";

const slugPath = z.object({
  slug: z.string().openapi({ description: "Pengenal destinasi.", example: "pantai-parangtritis" }),
});

const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });
const errorResponse = (description: string) => ({ description, content: json(errorSchema) });

const COMMON_ERRORS = {
  400: errorResponse("Input tidak valid (VALIDATION_ERROR)."),
  404: errorResponse("Destinasi tidak ditemukan (NOT_FOUND)."),
  500: errorResponse("Kesalahan server (INTERNAL_ERROR)."),
} as const;

export const registry = new OpenAPIRegistry();

registry.registerPath({
  method: "get",
  path: "/api/v1/destinations",
  tags: ["Destinasi"],
  summary: "Daftar destinasi",
  description:
    "20 destinasi pilihan di DIY. Dengan `include=scores`, tiap destinasi memuat skor slot terbaik untuk hari ini, besok, dan lusa (WIB).",
  request: {
    query: z.object({
      category: z.string().optional().openapi({
        description: "Satu atau lebih kategori, dipisah koma: pantai, alam, budaya, museum, desa_wisata.",
        example: "pantai,museum",
      }),
      q: z.string().optional().openapi({ description: "Cari berdasarkan nama (1-80 karakter).", example: "parang" }),
      bbox: z.string().optional().openapi({
        description: "Batas peta: minLon,minLat,maxLon,maxLat (derajat desimal).",
        example: "110.2,-8.1,110.6,-7.7",
      }),
      include: z.enum(["scores"]).optional().openapi({ description: "Sertakan skor terbaik per hari." }),
    }),
  },
  responses: {
    200: { description: "Daftar destinasi, diurutkan menurut nama.", content: json(destinationListSchema) },
    400: COMMON_ERRORS[400],
    500: COMMON_ERRORS[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/destinations/{slug}",
  tags: ["Destinasi"],
  summary: "Detail destinasi",
  request: { params: slugPath },
  responses: { 200: { description: "Detail destinasi.", content: json(destinationSchema) }, ...COMMON_ERRORS },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/destinations/{slug}/forecast",
  tags: ["Prakiraan"],
  summary: "Prakiraan BMKG per slot 3 jam beserta skor kelayakan",
  description:
    "Skor 0-100 dihitung per slot dari prakiraan BMKG dengan bobot sesuai kategori destinasi (lihat halaman /tentang-data). " +
    "Slot di luar jam buka bernilai `score: null` dan label `Tutup`. Bila BMKG tidak bisa diakses, data terakhir " +
    "tetap dikirim dengan `source.isStale: true` (status tetap 200).",
  request: {
    params: slugPath,
    query: z.object({
      days: z.number().int().min(1).max(3).optional().openapi({ description: "Jumlah hari (1-3), default 3.", example: 3 }),
    }),
  },
  responses: { 200: { description: "Prakiraan dan skor.", content: json(forecastResponseSchema) }, ...COMMON_ERRORS },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/destinations/{slug}/facilities",
  tags: ["Fasilitas"],
  summary: "Fasilitas sekitar destinasi, terdekat lebih dulu",
  description: "Data © OpenStreetMap contributors (ODbL), diimpor sekali dan disajikan dari database.",
  request: {
    params: slugPath,
    query: z.object({
      radius: z.number().int().min(100).max(3000).optional().openapi({ description: "Radius dalam meter, default 1000.", example: 1000 }),
      type: z.string().optional().openapi({
        description: "Tipe, dipisah koma: toilet, parkir, makan, ibadah, atm, halte, stasiun. Default semua.",
        example: "toilet,parkir",
      }),
    }),
  },
  responses: { 200: { description: "Fasilitas dalam radius.", content: json(facilitiesResponseSchema) }, ...COMMON_ERRORS },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/destinations/{slug}/alternatives",
  tags: ["Prakiraan"],
  summary: "Alternatif destinasi indoor saat cuaca buruk",
  description:
    "Terpicu hanya bila skor slot < 50 dan penalti terbesarnya hujan. Mengembalikan maksimal 3 destinasi indoor dalam radius " +
    "15 km yang buka pada slot itu dan berskor minimal 60, terdekat lebih dulu. Bila tidak ada, `otherSlot` berisi slot lain " +
    "di destinasi yang sama dengan skor tertinggi.",
  request: {
    params: slugPath,
    query: z.object({
      slot: z.string().openapi({ description: "Waktu di dalam slot (ISO 8601).", example: "2026-10-16T15:00:00+07:00" }),
    }),
  },
  responses: { 200: { description: "Alternatif untuk slot.", content: json(alternativesResponseSchema) }, ...COMMON_ERRORS },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/recommendations",
  tags: ["Prakiraan"],
  summary: "Destinasi terbaik lintas daftar untuk satu slot (F11)",
  description:
    "Mengurutkan seluruh 20 destinasi di DIY berdasarkan skor kelayakan kunjungan tertinggi pada slot waktu yang dipilih. " +
    "Destinasi yang tutup pada slot tersebut ditempatkan di bagian bawah.",
  request: {
    query: z.object({
      slot: z.string().openapi({ description: "Waktu di dalam slot (ISO 8601).", example: "2026-10-16T15:00:00+07:00" }),
      category: z.string().optional().openapi({ description: "Filter satu atau beberapa kategori dipisah koma.", example: "pantai,alam" }),
    }),
  },
  responses: {
    200: { description: "Daftar destinasi terurut skor tertinggi.", content: json(recommendationsResponseSchema) },
    400: COMMON_ERRORS[400],
    500: COMMON_ERRORS[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/alerts",
  tags: ["Prakiraan"],
  summary: "Peringatan dini cuaca aktif BMKG (F10)",
  description:
    "Mengembalikan daftar peringatan dini cuaca ekstrem aktif dari BMKG (CAP). Bila parameter `destination` disertakan, " +
    "hanya peringatan yang mengenai kecamatan atau wilayah destinasi tersebut yang dikembalikan.",
  request: {
    query: z.object({
      destination: z.string().optional().openapi({ description: "Slug destinasi.", example: "pantai-parangtritis" }),
      demo: z.enum(["1", "true"]).optional().openapi({ description: "Gunakan data peringatan simulasi bila tidak ada cuaca ekstrem aktif." }),
    }),
  },
  responses: {
    200: { description: "Daftar peringatan dini aktif.", content: json(alertListResponseSchema) },
    400: COMMON_ERRORS[400],
    404: COMMON_ERRORS[404],
    500: COMMON_ERRORS[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/health",
  tags: ["Sistem"],
  summary: "Status layanan",
  description:
    "Status basis data dan kesegaran data BMKG. Status HTTP 503 hanya bila basis data tidak terjangkau; data BMKG yang lama " +
    "menghasilkan `status: degraded` dengan HTTP 200.",
  responses: {
    200: { description: "Layanan berjalan.", content: json(healthResponseSchema) },
    503: { description: "Basis data tidak terjangkau.", content: json(healthResponseSchema) },
  },
});

/* ------------------------- rencana kunjungan (login) ------------------------- */

const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "Access token dari layanan login (Supabase Auth), mis. dari POST {SUPABASE_URL}/auth/v1/token?grant_type=password. " +
    "Rencana kunjungan hanya bisa dilihat dan diubah oleh pemiliknya.",
});
const secured = [{ [bearerAuth.name]: [] }];

const tripIdPath = z.object({ id: z.string().openapi({ description: "ID rencana (UUID).", example: "4d3f1c2e-7a54-4f0b-9a2e-0c5b2f6f1d11" }) });
const WRITE_ERRORS = {
  400: errorResponse("Input tidak valid atau batas jumlah tercapai (VALIDATION_ERROR)."),
  401: errorResponse("Belum login atau token tidak valid (UNAUTHORIZED)."),
  404: errorResponse("Rencana atau item tidak ditemukan. Rencana milik orang lain juga 404, bukan 403 (NOT_FOUND)."),
  429: errorResponse("Lebih dari 30 permintaan tulis per menit (RATE_LIMITED). Lihat header Retry-After."),
  500: errorResponse("Kesalahan server (INTERNAL_ERROR)."),
  503: errorResponse("Layanan login sedang tidak tersedia (UPSTREAM_UNAVAILABLE)."),
} as const;
const jsonBody = <T extends z.ZodType>(schema: T) => ({ required: true, content: json(schema) });

registry.registerPath({
  method: "get",
  path: "/api/v1/trips",
  tags: ["Rencana kunjungan"],
  summary: "Daftar rencana milik saya",
  security: secured,
  responses: {
    200: { description: "Rencana beserta isinya, terbaru dulu.", content: json(tripListSchema) },
    401: WRITE_ERRORS[401],
    500: WRITE_ERRORS[500],
    503: WRITE_ERRORS[503],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/trips",
  tags: ["Rencana kunjungan"],
  summary: "Buat rencana",
  description: "Judul 1 sampai 80 karakter. Maksimal 50 rencana per pengguna.",
  security: secured,
  request: { body: jsonBody(tripBody) },
  responses: { 201: { description: "Rencana dibuat.", content: json(tripSchema) }, ...WRITE_ERRORS },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/trips/{id}",
  tags: ["Rencana kunjungan"],
  summary: "Ubah judul rencana",
  security: secured,
  request: { params: tripIdPath, body: jsonBody(tripBody) },
  responses: { 200: { description: "Rencana diperbarui.", content: json(tripSchema) }, ...WRITE_ERRORS },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/trips/{id}",
  tags: ["Rencana kunjungan"],
  summary: "Hapus rencana beserta isinya",
  security: secured,
  request: { params: tripIdPath },
  responses: { 204: { description: "Dihapus." }, ...WRITE_ERRORS },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/trips/{id}/items",
  tags: ["Rencana kunjungan"],
  summary: "Tambah destinasi (dan slot) ke rencana",
  description:
    "Idempoten: destinasi + slot yang sama tidak digandakan (dibalas 200 dengan created=false). " +
    "`plannedSlot` harus dalam jangkauan prakiraan (maksimal 4 hari ke depan). Maksimal 30 item per rencana.",
  security: secured,
  request: { params: tripIdPath, body: jsonBody(addItemBody) },
  responses: {
    200: { description: "Item sudah ada.", content: json(addedItemSchema) },
    201: { description: "Item ditambahkan.", content: json(addedItemSchema) },
    ...WRITE_ERRORS,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/trips/{id}/items/{itemId}",
  tags: ["Rencana kunjungan"],
  summary: "Hapus satu item dari rencana",
  security: secured,
  request: { params: tripIdPath.extend({ itemId: z.string().openapi({ description: "ID item (UUID)." }) }) },
  responses: { 204: { description: "Dihapus." }, ...WRITE_ERRORS },
});

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "JelajahLokal API",
      version: "1.0.0",
      description:
        "API publik JelajahLokal: waktu terbaik mengunjungi 20 destinasi di DIY dalam 3 hari ke depan.\n\n" +
        "**Sumber data.** Prakiraan cuaca: BMKG. Fasilitas dan koordinat: © OpenStreetMap contributors (ODbL). " +
        "Skor adalah rekomendasi berbasis prakiraan, bukan jaminan kondisi di lokasi; ambang dan bobotnya adalah asumsi desain tim.\n\n" +
        "Semua error memakai format `{ \"error\": { \"code\", \"message\" } }`.",
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "Destinasi", description: "Daftar dan detail destinasi." },
      { name: "Prakiraan", description: "Prakiraan cuaca, skor, dan alternatif." },
      { name: "Fasilitas", description: "Fasilitas sekitar dari OpenStreetMap." },
      { name: "Rencana kunjungan", description: "Butuh login. Setiap pengguna hanya melihat rencananya sendiri." },
      { name: "Sistem", description: "Pemantauan." },
    ],
  });
}
