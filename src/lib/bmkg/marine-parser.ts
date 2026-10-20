// Parser respons API BMKG Maritim (https://maritim.bmkg.go.id/marine2026-data/).
// Menggabungkan forecast_day1 (resolusi 60 mnt) dan forecast_day2-4 (resolusi 180 mnt)
// menjadi satu array terurut tanpa duplikasi waktu.

import { z } from "zod";
import { BmkgParseError } from "./parser";

export const KNOWN_WAVE_CATS = [
  "Tenang",
  "Rendah",
  "Sedang",
  "Tinggi",
  "Sangat Tinggi",
  "Ekstrem",
  "Sangat Ekstrem",
] as const;

export type KnownWaveCat = (typeof KNOWN_WAVE_CATS)[number];

export const isKnownWaveCat = (value: string): value is KnownWaveCat =>
  (KNOWN_WAVE_CATS as readonly string[]).includes(value);

const optionalNumber = z.number().nullable().optional();
const optionalText = z.string().nullable().optional();

const rawPointSchema = z.object({
  time: z.string(),
  weather: optionalText,
  temp_avg: optionalNumber,
  rh_avg: optionalNumber,
  wind_from: optionalText,
  wind_speed: optionalNumber,
  wind_gust: optionalNumber,
  wave_cat: optionalText,
  wave_height: optionalNumber,
  current_to: optionalText,
  current_speed: optionalNumber,
});

const marineResponseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  no_surat: optionalText,
  nama_prakirawan: optionalText,
  nama_stasiun: optionalText,
  issued: z.string().min(1),
  valid_from: optionalText,
  valid_to: optionalText,
  forecast_day1: z.array(rawPointSchema).default([]),
  "forecast_day2-4": z.array(rawPointSchema).default([]),
});

export type ParsedMarinePoint = {
  validAt: Date;
  resolutionMinutes: 60 | 180;
  waveCat: string | null;
  waveHeight: number | null;
  windFrom: string | null;
  windSpeedKt: number | null;
  windGustKt: number | null;
  currentTo: string | null;
  currentSpeedKt: number | null;
  weather: string | null;
};

export type ParsedMarineForecast = {
  code: string;
  name: string;
  issuedAt: Date;
  stationName: string | null;
  points: ParsedMarinePoint[];
};

export type MarineParserHooks = {
  onUnknownWaveCat?: (waveCat: string) => void;
};

export function parseMarineUtc(value: string, field = "time"): Date {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+UTC$/.exec(trimmed);
  if (match) {
    const [, y, m, d, h, min, s] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s || 0)));
    if (!Number.isNaN(date.getTime())) return date;
  }

  // Fallback ISO format bila API mengirim standar ISO
  const iso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const fallback = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(fallback.getTime())) {
    throw new BmkgParseError(`Format waktu maritim tidak valid pada ${field}: "${value}"`);
  }
  return fallback;
}

export function parseMarineResponse(raw: unknown, hooks?: MarineParserHooks): ParsedMarineForecast {
  const result = marineResponseSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new BmkgParseError(
      `Respons maritim BMKG tidak sesuai format: ${issue?.path.join(".") || "(root)"}: ${issue?.message}`,
    );
  }

  const data = result.data;
  const issuedAt = parseMarineUtc(data.issued, "issued");
  const byTimestamp = new Map<number, ParsedMarinePoint>();

  const processPoint = (rawPoint: z.infer<typeof rawPointSchema>, resolutionMinutes: 60 | 180) => {
    const validAt = parseMarineUtc(rawPoint.time, "time");
    const ts = validAt.getTime();

    // Jika waktu sudah ada dari resolusi 60 (day1), abaikan yang resolusi 180
    if (byTimestamp.has(ts)) return;

    const waveCat = rawPoint.wave_cat?.trim() || null;
    if (waveCat && !isKnownWaveCat(waveCat)) {
      hooks?.onUnknownWaveCat?.(waveCat);
    }

    byTimestamp.set(ts, {
      validAt,
      resolutionMinutes,
      waveCat,
      waveHeight: rawPoint.wave_height ?? null,
      windFrom: rawPoint.wind_from?.trim() || null,
      windSpeedKt: rawPoint.wind_speed ?? null,
      windGustKt: rawPoint.wind_gust ?? null,
      currentTo: rawPoint.current_to?.trim() || null,
      currentSpeedKt: rawPoint.current_speed ?? null,
      weather: rawPoint.weather?.trim() || null,
    });
  };

  for (const pt of data.forecast_day1) {
    processPoint(pt, 60);
  }

  for (const pt of data["forecast_day2-4"]) {
    processPoint(pt, 180);
  }

  const sortedPoints = [...byTimestamp.values()].sort((a, b) => a.validAt.getTime() - b.validAt.getTime());

  return {
    code: data.code,
    name: data.name,
    issuedAt,
    stationName: data.nama_stasiun?.trim() || null,
    points: sortedPoints,
  };
}
