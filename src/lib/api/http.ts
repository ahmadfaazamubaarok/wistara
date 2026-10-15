import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ApiError, describeZodError } from "./errors";

/** Cache untuk endpoint publik hanya-baca: CDN Vercel ikut menahan beban (Rancangan Teknis). */
export const PUBLIC_CACHE_CONTROL = "public, s-maxage=600, stale-while-revalidate=3600";

export function publicJson<T>(body: T, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": PUBLIC_CACHE_CONTROL } });
}

export function noStoreJson<T>(body: T, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Validasi parameter query dengan skema; parameter yang tidak dikenal diabaikan. */
export function parseQuery<T>(schema: ZodType<T>, request: Request): T {
  const raw = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError("VALIDATION_ERROR", describeZodError(result.error));
  return result.data;
}

export function parseParams<T>(schema: ZodType<T>, params: unknown): T {
  const result = schema.safeParse(params);
  if (!result.success) throw new ApiError("VALIDATION_ERROR", describeZodError(result.error));
  return result.data;
}

export const googleMapsRouteUrl = (lat: number, lon: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}`;

const MAX_BODY_BYTES = 10_000;

/** Baca dan validasi body JSON (maksimal 10 KB). Body kosong/rusak/bukan objek -> 400. */
export async function parseJsonBody<T>(schema: ZodType<T>, request: Request): Promise<T> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError("VALIDATION_ERROR", "Body terlalu besar (maksimal 10 KB)");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Body harus berupa JSON yang valid");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError("VALIDATION_ERROR", describeZodError(result.error));
  return result.data;
}
