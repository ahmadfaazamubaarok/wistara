// Klien API publik BMKG. Hanya dipanggil dari server (PRD: browser tidak
// pernah memanggil BMKG). Batas BMKG: 60 permintaan/menit/IP; pemanggil
// bertanggung jawab menjaga laju (cron memberi jeda ~1,1 detik per wilayah).

import { parseBmkgResponse, type ParsedForecast } from "./parser";

export const BMKG_DEFAULT_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca";
export const ADM4_PATTERN = /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/;

export class BmkgError extends Error {
  constructor(
    message: string,
    /** Status HTTP bila ada respons; null untuk timeout/jaringan/format. */
    readonly status: number | null,
  ) {
    super(message);
    this.name = "BmkgError";
  }
}

export type FetchBmkgOptions = {
  /** Bisa diganti lewat BMKG_API_BASE_URL (dipakai untuk uji ketahanan). */
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

async function attempt(url: string, timeoutMs: number, fetchImpl: typeof fetch) {
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
    throw new BmkgError(`Gagal menghubungi BMKG (${reason})`, null);
  }

  if (!response.ok) {
    throw new BmkgError(`BMKG membalas HTTP ${response.status}`, response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new BmkgError("Respons BMKG bukan JSON yang valid", null);
  }

  try {
    return parseBmkgResponse(body);
  } catch (error) {
    throw new BmkgError(error instanceof Error ? error.message : "Format respons BMKG tidak dikenal", null);
  }
}

export async function fetchBmkgForecast(
  adm4: string,
  options: FetchBmkgOptions = {},
): Promise<ParsedForecast> {
  if (!ADM4_PATTERN.test(adm4)) {
    throw new BmkgError(`Kode adm4 tidak valid: "${adm4}"`, null);
  }

  const {
    baseUrl = process.env.BMKG_API_BASE_URL || BMKG_DEFAULT_URL,
    timeoutMs = 8000,
    retries = 1,
    fetchImpl = fetch,
  } = options;
  const url = `${baseUrl}?adm4=${encodeURIComponent(adm4)}`;

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
