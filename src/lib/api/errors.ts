// Format error API yang seragam (Rancangan Teknis, "Konvensi"):
//   { "error": { "code": "VALIDATION_ERROR", "message": "..." } }
// dengan status 400, 401, 404, 429, atau 503.

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const API_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_STATUS;

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(code: ApiErrorCode, message: string, headers?: Record<string, string>) {
  return NextResponse.json(
    { error: { code, message } },
    { status: API_ERROR_STATUS[code], headers: { "Cache-Control": "no-store", ...headers } },
  );
}

/** Pesan validasi pertama yang paling berguna, bukan seluruh pohon error Zod. */
export function describeZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Input tidak valid";
  // Indeks array (mis. "type.0") tidak berguna bagi pemakai API; sebut nama parameternya saja.
  const field = issue.path.filter((part) => typeof part !== "number").join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

type Handler<Ctx> = (request: Request, context: Ctx) => Promise<Response>;

/**
 * Membungkus route handler: ApiError dan ZodError diubah ke format seragam,
 * error tak terduga dicatat di server dan dibalas 500 tanpa membocorkan detail.
 */
export function withApi<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error.code, error.message, error.headers);
      if (error instanceof ZodError) return errorResponse("VALIDATION_ERROR", describeZodError(error));
      console.error(`[api] ${request.method} ${new URL(request.url).pathname} gagal:`, error);
      return errorResponse("INTERNAL_ERROR", "Terjadi kesalahan pada server");
    }
  };
}
