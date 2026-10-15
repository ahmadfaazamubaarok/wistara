// Parser respons BMKG Prakiraan Cuaca. Struktur diverifikasi terhadap respons
// asli (lihat __fixtures__): data[0].cuaca adalah array per hari berisi slot 3 jam.

import { z } from "zod";

const optionalNumber = z.number().nullable().optional();
const optionalText = z.string().nullable().optional();

const slotSchema = z.object({
  utc_datetime: z.string(), // "2026-10-15 17:00:00" (UTC, tanpa penanda zona)
  local_datetime: z.string(), // "2026-10-16 00:00:00" (WIB, tanpa penanda zona)
  analysis_date: z.string(), // "2026-10-15T12:00:00" (UTC, tanpa penanda zona)
  t: optionalNumber,
  hu: optionalNumber,
  ws: optionalNumber,
  tcc: optionalNumber,
  wd: optionalText,
  vs_text: optionalText,
  weather_desc: optionalText,
});

const responseSchema = z.object({
  lokasi: z.object({
    adm4: z.string(),
    provinsi: z.string().optional(),
    kotkab: z.string(),
    kecamatan: z.string(),
    desa: z.string(),
    lat: z.number().optional(),
    lon: z.number().optional(),
  }),
  data: z.array(z.object({ cuaca: z.array(z.array(slotSchema)) })).min(1),
});

export type ParsedSlot = {
  validAt: Date;
  /** Waktu lokal WIB tanpa zona, format ISO: "2026-10-16T00:00:00". */
  localTime: string;
  t: number | null;
  hu: number | null;
  ws: number | null;
  wd: string | null;
  tcc: number | null;
  vsText: string | null;
  weatherDesc: string | null;
  analysisDate: Date;
};

export type ParsedForecast = {
  location: {
    adm4: string;
    desa: string;
    kecamatan: string;
    kabupaten: string;
    lat: number | null;
    lon: number | null;
  };
  slots: ParsedSlot[];
};

export class BmkgParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BmkgParseError";
  }
}

function parseUtc(value: string, field: string): Date {
  // BMKG memakai spasi atau "T" sebagai pemisah dan tidak menyertakan zona.
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BmkgParseError(`Tanggal tidak valid pada ${field}: "${value}"`);
  }
  return date;
}

function toLocalIso(value: string): string {
  const iso = value.replace(" ", "T");
  if (Number.isNaN(new Date(`${iso}Z`).getTime())) {
    throw new BmkgParseError(`Tanggal tidak valid pada local_datetime: "${value}"`);
  }
  return iso;
}

export function parseBmkgResponse(raw: unknown): ParsedForecast {
  const result = responseSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new BmkgParseError(
      `Respons BMKG tidak sesuai format: ${issue?.path.join(".") || "(root)"}: ${issue?.message}`,
    );
  }

  const { lokasi, data } = result.data;
  const byValidAt = new Map<number, ParsedSlot>();

  for (const slot of data[0].cuaca.flat()) {
    const validAt = parseUtc(slot.utc_datetime, "utc_datetime");
    byValidAt.set(validAt.getTime(), {
      validAt,
      localTime: toLocalIso(slot.local_datetime),
      t: slot.t ?? null,
      hu: slot.hu ?? null,
      ws: slot.ws ?? null,
      wd: slot.wd ?? null,
      tcc: slot.tcc ?? null,
      vsText: slot.vs_text ?? null,
      weatherDesc: slot.weather_desc ?? null,
      analysisDate: parseUtc(slot.analysis_date, "analysis_date"),
    });
  }

  return {
    location: {
      adm4: lokasi.adm4,
      desa: lokasi.desa,
      kecamatan: lokasi.kecamatan,
      kabupaten: lokasi.kotkab,
      lat: lokasi.lat ?? null,
      lon: lokasi.lon ?? null,
    },
    slots: [...byValidAt.values()].sort((a, b) => a.validAt.getTime() - b.validAt.getTime()),
  };
}
