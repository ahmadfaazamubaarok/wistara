import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { type DestCategory, DEST_CATEGORIES } from "@/lib/categories";
import { getPool } from "@/lib/db";
import { parseOpenHours, type OpenHours } from "@/lib/scoring/open-hours";
import { isAdmin, requireAdmin } from "@/lib/submissions/service";
import { slugify } from "@/lib/submissions/slug";

export type AdminDestination = {
  id: string;
  slug: string;
  name: string;
  category: DestCategory;
  isIndoor: boolean;
  adm4Code: string;
  lat: number;
  lon: number;
  openHours: OpenHours | null;
  description: string | null;
  osmRef: string | null;
  verifiedAt: string | null;
  marineAreaCode: string | null;
  origin: "seed" | "usulan";
  region: { desa: string; kecamatan: string; kabupaten: string };
};

type Row = {
  id: string;
  slug: string;
  name: string;
  category: DestCategory;
  is_indoor: boolean;
  adm4_code: string;
  lat: number;
  lon: number;
  open_hours: unknown;
  description: string | null;
  osm_ref: string | null;
  verified_at: string | null;
  marine_area_code: string | null;
  origin: "seed" | "usulan";
  desa: string;
  kecamatan: string;
  kabupaten: string;
};

const point = (lon: string, lat: string) =>
  `extensions.st_setsrid(extensions.st_makepoint(${lon}, ${lat}), 4326)::extensions.geography`;

function mapRow(r: Row): AdminDestination {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    isIndoor: r.is_indoor,
    adm4Code: r.adm4_code,
    lat: r.lat,
    lon: r.lon,
    openHours: parseOpenHours(r.open_hours),
    description: r.description,
    osmRef: r.osm_ref,
    verifiedAt: r.verified_at,
    marineAreaCode: r.marine_area_code,
    origin: r.origin,
    region: { desa: r.desa, kecamatan: r.kecamatan, kabupaten: r.kabupaten },
  };
}

export type AdminDestinationListOptions = {
  q?: string;
  category?: string;
  kabupaten?: string;
  page?: number;
  limit?: number;
};

export async function listAdminDestinations(adminId: string, options: AdminDestinationListOptions = {}) {
  await requireAdmin(adminId);
  const pool = getPool();
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (val: unknown) => {
    params.push(val);
    return `$${params.length}`;
  };

  if (options.q && options.q.trim()) {
    const escaped = options.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
    where.push(`(d.name ilike ${bind(`%${escaped}%`)} escape '\\' or d.slug ilike ${bind(`%${escaped}%`)} escape '\\')`);
  }

  if (options.category && DEST_CATEGORIES.includes(options.category as DestCategory)) {
    where.push(`d.category = ${bind(options.category)}::dest_category`);
  }

  if (options.kabupaten && options.kabupaten.trim()) {
    where.push(`r.kabupaten = ${bind(options.kabupaten.trim())}`);
  }

  const whereClause = where.length ? `where ${where.join(" and ")}` : "";

  const countQuery = `
    select count(*) as total
    from destinations d
    join regions r on r.adm4_code = d.adm4_code
    ${whereClause}
  `;
  const countRes = await pool.query<{ total: string }>(countQuery, params);
  const total = Number(countRes.rows[0]?.total ?? 0);

  const dataQuery = `
    select d.id, d.slug, d.name, d.category, d.is_indoor, d.adm4_code,
           extensions.st_y(d.location::extensions.geometry) as lat,
           extensions.st_x(d.location::extensions.geometry) as lon,
           d.open_hours, d.description, d.osm_ref,
           to_char(d.verified_at, 'YYYY-MM-DD') as verified_at,
           d.marine_area_code, d.origin,
           r.desa, r.kecamatan, r.kabupaten
    from destinations d
    join regions r on r.adm4_code = d.adm4_code
    ${whereClause}
    order by d.name asc
    limit ${bind(limit)} offset ${bind(offset)}
  `;

  const { rows } = await pool.query<Row>(dataQuery, params);
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    items: rows.map(mapRow),
    total,
    page,
    limit,
    totalPages,
  };
}

export async function getAdminDestinationById(adminId: string, id: string): Promise<AdminDestination | null> {
  await requireAdmin(adminId);
  const pool = getPool();
  const { rows } = await pool.query<Row>(
    `select d.id, d.slug, d.name, d.category, d.is_indoor, d.adm4_code,
            extensions.st_y(d.location::extensions.geometry) as lat,
            extensions.st_x(d.location::extensions.geometry) as lon,
            d.open_hours, d.description, d.osm_ref,
            to_char(d.verified_at, 'YYYY-MM-DD') as verified_at,
            d.marine_area_code, d.origin,
            r.desa, r.kecamatan, r.kabupaten
     from destinations d
     join regions r on r.adm4_code = d.adm4_code
     where d.id = $1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export const adminDestinationSchema = z.object({
  name: z.string().trim().min(3, "Nama destinasi minimal 3 karakter").max(80, "Nama maksimal 80 karakter"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,80}$/, "Slug hanya huruf kecil, angka, dan tanda hubung (maksimal 80)"),
  category: z.enum(["pantai", "alam", "budaya", "museum", "desa_wisata"] as const, {
    error: "Pilih kategori yang valid",
  }),
  isIndoor: z.boolean(),
  adm4Code: z.string().regex(/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/, "Pilih wilayah cuaca yang valid"),
  marineAreaCode: z
    .string()
    .regex(/^[A-Z]\.[A-Z]{1,2}\.\d{2}$/, "Kode wilayah perairan tidak valid")
    .nullable(),
  lat: z.number().min(-8.25, "Koordinat di luar batas DIY").max(-7.5, "Koordinat di luar batas DIY"),
  lon: z.number().min(110.0, "Koordinat di luar batas DIY").max(110.85, "Koordinat di luar batas DIY"),
  openHours: z.record(z.string(), z.array(z.string())).nullable(),
  description: z.string().trim().max(600, "Deskripsi maksimal 600 karakter").nullable(),
  osmRef: z.string().trim().max(80).nullable().optional(),
  hoursVerified: z.boolean(),
});

export type AdminDestinationInput = z.infer<typeof adminDestinationSchema>;

export async function createAdminDestination(adminId: string, input: AdminDestinationInput): Promise<{ id: string; slug: string }> {
  await requireAdmin(adminId);
  const pool = getPool();

  if (input.marineAreaCode && input.category !== "pantai") {
    throw new ApiError("VALIDATION_ERROR", "Wilayah perairan maritim hanya dapat diatur untuk kategori pantai.");
  }

  // Cek keunikan slug
  const slugCheck = await pool.query<{ id: string }>("select id from destinations where slug = $1", [input.slug]);
  if (slugCheck.rows[0]) {
    throw new ApiError("VALIDATION_ERROR", `Slug "${input.slug}" sudah digunakan oleh destinasi lain.`);
  }

  // Cek wilayah cuaca
  const regionCheck = await pool.query<{ adm4_code: string }>("select adm4_code from regions where adm4_code = $1", [input.adm4Code]);
  if (!regionCheck.rows[0]) {
    throw new ApiError("VALIDATION_ERROR", "Wilayah cuaca tidak ditemukan.");
  }

  const { rows } = await pool.query<{ id: string }>(
    `insert into destinations
       (slug, name, category, is_indoor, adm4_code, location, open_hours, description, osm_ref,
        verified_at, marine_area_code, origin)
     values
       ($1, $2, $3, $4, $5, ${point("$6", "$7")}, $8::jsonb, $9, $10,
        case when $11::boolean and $8::jsonb is not null then (now() at time zone 'Asia/Jakarta')::date end,
        $12, 'usulan')
     returning id`,
    [
      input.slug,
      input.name,
      input.category,
      input.isIndoor,
      input.adm4Code,
      input.lon,
      input.lat,
      input.openHours ? JSON.stringify(input.openHours) : null,
      input.description || null,
      input.osmRef || null,
      input.hoursVerified,
      input.marineAreaCode || null,
    ],
  );

  revalidatePath("/");
  revalidatePath("/destinasi");
  revalidatePath("/admin/destinasi");

  return { id: rows[0].id, slug: input.slug };
}

export async function updateAdminDestination(
  adminId: string,
  id: string,
  input: AdminDestinationInput,
): Promise<{ id: string; slug: string }> {
  await requireAdmin(adminId);
  const pool = getPool();

  if (input.marineAreaCode && input.category !== "pantai") {
    throw new ApiError("VALIDATION_ERROR", "Wilayah perairan maritim hanya dapat diatur untuk kategori pantai.");
  }

  // Cek destinasi ada
  const existing = await pool.query<{ slug: string }>("select slug from destinations where id = $1", [id]);
  if (!existing.rows[0]) {
    throw new ApiError("NOT_FOUND", "Destinasi tidak ditemukan.");
  }

  // Cek keunikan slug terhadap destinasi lain
  const slugCheck = await pool.query<{ id: string }>("select id from destinations where slug = $1 and id != $2", [input.slug, id]);
  if (slugCheck.rows[0]) {
    throw new ApiError("VALIDATION_ERROR", `Slug "${input.slug}" sudah digunakan oleh destinasi lain.`);
  }

  // Cek wilayah cuaca
  const regionCheck = await pool.query<{ adm4_code: string }>("select adm4_code from regions where adm4_code = $1", [input.adm4Code]);
  if (!regionCheck.rows[0]) {
    throw new ApiError("VALIDATION_ERROR", "Wilayah cuaca tidak ditemukan.");
  }

  await pool.query(
    `update destinations
     set slug = $2,
         name = $3,
         category = $4,
         is_indoor = $5,
         adm4_code = $6,
         location = ${point("$7", "$8")},
         open_hours = $9::jsonb,
         description = $10,
         osm_ref = $11,
         verified_at = case
           when $12::boolean and $9::jsonb is not null then coalesce(verified_at, (now() at time zone 'Asia/Jakarta')::date)
           else null
         end,
         marine_area_code = $13
     where id = $1`,
    [
      id,
      input.slug,
      input.name,
      input.category,
      input.isIndoor,
      input.adm4Code,
      input.lon,
      input.lat,
      input.openHours ? JSON.stringify(input.openHours) : null,
      input.description || null,
      input.osmRef || null,
      input.hoursVerified,
      input.marineAreaCode || null,
    ],
  );

  revalidatePath("/");
  revalidatePath("/destinasi");
  revalidatePath(`/destinasi/${existing.rows[0].slug}`);
  if (existing.rows[0].slug !== input.slug) {
    revalidatePath(`/destinasi/${input.slug}`);
  }
  revalidatePath("/admin/destinasi");
  revalidatePath(`/admin/destinasi/${id}`);

  return { id, slug: input.slug };
}

export async function deleteAdminDestination(adminId: string, id: string): Promise<void> {
  await requireAdmin(adminId);
  const pool = getPool();

  const existing = await pool.query<{ slug: string }>("select slug from destinations where id = $1", [id]);
  if (!existing.rows[0]) {
    throw new ApiError("NOT_FOUND", "Destinasi tidak ditemukan.");
  }

  await pool.query("delete from destinations where id = $1", [id]);

  revalidatePath("/");
  revalidatePath("/destinasi");
  revalidatePath(`/destinasi/${existing.rows[0].slug}`);
  revalidatePath("/admin/destinasi");
}
