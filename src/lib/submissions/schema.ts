// Validasi usulan destinasi. Satu skema untuk Server Action (formulir) dan layanan, sehingga
// aturan yang sama berlaku di mana pun data masuk. Batas DIY diperiksa DI SERVER, bukan hanya di peta.

import { z } from "zod";
import { DEST_CATEGORIES } from "../categories";
import { isInsideDiy } from "../geo/diy-boundary";
import { DAY_KEYS, type OpenHours } from "../scoring/open-hours";
import { KABUPATEN_DIY, MANAGER_ROLES } from "./constants";

/**
 * 0812-3456-7890 / +62 812 3456 7890 / 6281234567890 -> "6281234567890".
 * null bila bukan nomor ponsel Indonesia (WhatsApp tidak bekerja di telepon rumah).
 */
export function normalizeWhatsapp(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  let national: string;
  if (/^\+62\d+$/.test(compact)) national = compact.slice(3);
  else if (/^62\d+$/.test(compact)) national = compact.slice(2);
  else if (/^0\d+$/.test(compact)) national = compact.slice(1);
  else return null;
  // Nomor ponsel Indonesia diawali 8 setelah kode negara, total 9-12 digit.
  return /^8\d{8,11}$/.test(national) ? `62${national}` : null;
}

/** Jam buka yang sama untuk semua hari, kecuali hari yang ditandai tutup. */
export function buildOpenHours(openTime: string, closeTime: string, closedDays: readonly string[]): OpenHours {
  const hours: OpenHours = {};
  for (const day of DAY_KEYS) {
    if (!closedDays.includes(day)) hours[day] = [openTime, closeTime];
  }
  return hours;
}

const collapse = (value: string) => value.replace(/\s+/g, " ").trim();
const NO_CONTROL_CHARS = /^[^\u0000-\u001f\u007f]*$/;

/** Teks satu baris wajib: spasi dirapikan, panjang dibatasi, tanpa karakter kontrol. */
const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} wajib diisi` })
    .transform(collapse)
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `${label} wajib diisi` : `${label} minimal ${min} karakter`)
        .max(max, `${label} maksimal ${max} karakter`)
        .regex(NO_CONTROL_CHARS, `${label} mengandung karakter yang tidak valid`),
    );

const optionalText = (label: string, max: number) =>
  z
    .string()
    .optional()
    .transform((value) => collapse(value ?? ""))
    .pipe(z.string().max(max, `${label} maksimal ${max} karakter`).regex(NO_CONTROL_CHARS, `${label} mengandung karakter yang tidak valid`))
    .transform((value) => value || null);

const coordinate = z
  .union([z.number(), z.string()], { error: "Pilih lokasi di peta atau isi koordinat" })
  .transform((value) => (typeof value === "number" ? value : value.trim() === "" ? Number.NaN : Number(value.trim().replace(",", "."))))
  .refine(Number.isFinite, { error: "Pilih lokasi di peta atau isi koordinat" });

const timeOfDay = z
  .string()
  .optional()
  .transform((value) => value?.trim() ?? "")
  .pipe(z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/, "Format jam harus HH:MM")]));

export const submissionSchema = z
  .object({
    name: requiredText("Nama destinasi", 3, 80),
    category: z.enum(DEST_CATEGORIES, { error: "Pilih kategori" }),
    isIndoor: z.boolean().default(false),
    lat: coordinate,
    lon: coordinate,
    kabupaten: z.enum(KABUPATEN_DIY, { error: "Pilih kabupaten/kota" }),
    address: requiredText("Alamat", 10, 300),
    openTime: timeOfDay,
    closeTime: timeOfDay,
    closedDays: z.array(z.enum(DAY_KEYS)).default([]),
    description: optionalText("Deskripsi", 600),
    managerName: requiredText("Nama pengelola atau lembaga", 2, 100),
    managerRole: z.enum(MANAGER_ROLES, { error: "Pilih hubungan Anda dengan destinasi" }),
    contactWa: z
      .string({ error: "Nomor WhatsApp wajib diisi" })
      .trim()
      .refine((value) => normalizeWhatsapp(value) !== null, {
        error: "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890",
      })
      .transform((value) => normalizeWhatsapp(value) as string),
    evidenceUrl: optionalText("Tautan bukti", 300).refine((value) => value === null || /^https?:\/\/\S{3,290}$/.test(value), {
      error: "Tautan harus diawali http:// atau https://",
    }),
    consent: z.literal(true, { error: "Centang persetujuan penggunaan kontak untuk melanjutkan" }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.lat < -90 || value.lat > 90 || value.lon < -180 || value.lon > 180) {
      ctx.addIssue({ code: "custom", path: ["lat"], message: "Koordinat di luar jangkauan yang valid" });
    } else if (!isInsideDiy(value.lat, value.lon)) {
      ctx.addIssue({
        code: "custom",
        path: ["lat"],
        message: "Lokasi berada di luar Daerah Istimewa Yogyakarta. Saat ini Wistara hanya mencakup DIY.",
      });
    }

    const hasOpen = value.openTime !== "";
    const hasClose = value.closeTime !== "";
    if (hasOpen !== hasClose) {
      ctx.addIssue({ code: "custom", path: [hasOpen ? "closeTime" : "openTime"], message: "Isi jam buka dan jam tutup sekaligus, atau kosongkan keduanya" });
    } else if (hasOpen && value.openTime >= value.closeTime) {
      ctx.addIssue({ code: "custom", path: ["closeTime"], message: "Jam tutup harus setelah jam buka" });
    }
    if (hasOpen && hasClose && value.closedDays.length >= DAY_KEYS.length) {
      ctx.addIssue({ code: "custom", path: ["closedDays"], message: "Minimal satu hari harus buka" });
    }
  })
  .transform(({ openTime, closeTime, closedDays, ...rest }) => ({
    ...rest,
    openHours: openTime && closeTime ? buildOpenHours(openTime, closeTime, closedDays) : (null as OpenHours | null),
  }));

export type SubmissionInput = z.output<typeof submissionSchema>;

/** FormData dari formulir -> objek mentah untuk submissionSchema. */
export function rawFromFormData(formData: FormData): Record<string, unknown> {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return {
    name: text("name"),
    category: text("category"),
    isIndoor: formData.get("isIndoor") === "on",
    lat: text("lat"),
    lon: text("lon"),
    kabupaten: text("kabupaten"),
    address: text("address"),
    openTime: text("openTime"),
    closeTime: text("closeTime"),
    closedDays: formData.getAll("closedDays").filter((value): value is string => typeof value === "string"),
    description: text("description"),
    managerName: text("managerName"),
    managerRole: text("managerRole"),
    contactWa: text("contactWa"),
    evidenceUrl: text("evidenceUrl"),
    consent: formData.get("consent") === "on",
  };
}

/** Galat Zod -> satu pesan per kolom (yang pertama), untuk ditampilkan di samping isian. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!(field in result)) result[field] = issue.message;
  }
  return result;
}
