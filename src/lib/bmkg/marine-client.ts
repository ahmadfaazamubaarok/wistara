// Klien API BMKG Maritim (https://maritim.bmkg.go.id/marine2026-data/).
// Hanya dipanggil dari server (PRD: browser tidak pernah memanggil BMKG).

import { BmkgError } from "./client";
import { parseMarineResponse, type ParsedMarineForecast } from "./marine-parser";

export const BMKG_MARINE_DEFAULT_URL = "https://maritim.bmkg.go.id/marine2026-data/";
export const MARINE_CODE_PATTERN = /^P\.N\.0[1-3]$/;

export type FetchMarineOptions = {
  /** Bisa diganti lewat BMKG_MARINE_BASE_URL (misalnya untuk uji ketahanan). */
  baseUrl?: string;
  timeoutMs?: number;
  /** Jumlah percobaan ulang setelah gagal (jaringan, timeout, 429, 5xx). */
  retries?: number;
  fetchImpl?: typeof fetch;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(error: BmkgError): boolean {
  return error.status === null || error.status === 429 || error.status >= 500;
}

async function attempt(url: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<ParsedMarineForecast> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Wistara/0.1 (proyek mahasiswa UINIC 8.0)",
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    throw new BmkgError(`Gagal menghubungi BMKG Maritim (${reason})`, null);
  }

  if (!response.ok) {
    throw new BmkgError(`BMKG Maritim membalas HTTP ${response.status}`, response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new BmkgError("Respons BMKG Maritim bukan JSON yang valid", null);
  }

  try {
    return parseMarineResponse(body);
  } catch (error) {
    throw new BmkgError(
      error instanceof Error ? error.message : "Format respons BMKG Maritim tidak dikenal",
      null,
    );
  }
}

export async function fetchMarineForecast(
  code: string,
  options: FetchMarineOptions = {},
): Promise<ParsedMarineForecast> {
  if (!MARINE_CODE_PATTERN.test(code)) {
    throw new BmkgError(`Kode perairan maritim tidak valid: "${code}"`, null);
  }

  const {
    baseUrl = process.env.BMKG_MARINE_BASE_URL || BMKG_MARINE_DEFAULT_URL,
    timeoutMs = 8000,
    retries = 1,
    fetchImpl = fetch,
  } = options;

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const url = `${normalizedBase}/perairan/${encodeURIComponent(code)}.json`;

  let lastError: BmkgError | undefined;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await attempt(url, timeoutMs, fetchImpl);
    } catch (error) {
      lastError = error as BmkgError;
      if (!isRetryable(lastError) || i === retries) break;
      await sleep(500);
    }
  }
  throw lastError!;
}
