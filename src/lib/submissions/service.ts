// Usulan destinasi (F13).
//
// Bagian PENGGUNA berjalan lewat withUser() sebagai role `authenticated`, sehingga RLS di database
// yang membatasi akses (pengguna hanya melihat dan menarik usulannya sendiri), bukan filter di kode.
//
// Bagian ADMIN memakai koneksi server (melewati RLS) dan SELALU diawali requireAdmin(). Pemeriksaan
// ini sengaja ada di layanan, bukan hanya di halaman, agar Server Action yang dipanggil langsung
// tetap tertolak. Pengguna non-admin menerima NOT_FOUND (bukan 403): halaman tampil seperti tidak ada.

import { z } from "zod";
import { ApiError } from "../api/errors";
import type { DestCategory } from "../categories";
import { getPool } from "../db";
import { parseOpenHours, type OpenHours } from "../scoring/open-hours";
import { withUser } from "../trips/service";
import type { ManagerRole, SubmissionStatus } from "./constants";
import type { SubmissionInput } from "./schema";
import { slugify } from "./slug";

/** Titik yang lebih dekat dari ini ke destinasi yang sudah ada dianggap tempat yang sama. */
export const DUPLICATE_RADIUS_M = 75;
/** Radius kandidat duplikat yang ditampilkan ke admin saat meninjau. */
const REVIEW_NEARBY_RADIUS_M = 500;
/** Pantai terdekat yang dipakai untuk menyarankan wilayah perairan. */
const MARINE_SUGGEST_RADIUS_M = 5000;

export type Submission = {
  id: string;
  status: SubmissionStatus;
  name: string;
  category: DestCategory;
  isIndoor: boolean;
  lat: number;
  lon: number;
  kabupaten: string;
  address: string;
  openHours: OpenHours | null;
  description: string | null;
  managerName: string;
  managerRole: ManagerRole;
  /** Nomor WA ternormalisasi (62...). Hanya untuk pemilik usulan dan admin; kosong setelah ditolak. */
  contactWa: string | null;
  evidenceUrl: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  destination: { slug: string; name: string } | null;
};

type SubmissionRow = {
  id: string; status: SubmissionStatus; name: string; category: DestCategory; is_indoor: boolean;
  lat: number; lon: number; kabupaten: string; address: string; open_hours: unknown;
  description: string | null; manager_name: string; manager_role: ManagerRole;
  contact_wa: string | null; evidence_url: string | null;
  created_at: Date; reviewed_at: Date | null; review_note: string | null;
  destination_slug: string | null; destination_name: string | null;
};

const COLUMNS = `s.id, s.status, s.name, s.category, s.is_indoor,
  extensions.st_y(s.location::extensions.geometry) as lat,
  extensions.st_x(s.location::extensions.geometry) as lon,
  s.kabupaten, s.address, s.open_hours, s.description, s.manager_name, s.manager_role,
  s.contact_wa, s.evidence_url, s.created_at, s.reviewed_at, s.review_note,
  d.slug as destination_slug, d.name as destination_name`;
const FROM = "from destination_submissions s left join destinations d on d.id = s.destination_id";

const toSubmission = (row: SubmissionRow): Submission => ({
  id: row.id,
  status: row.status,
  name: row.name,
  category: row.category,
  isIndoor: row.is_indoor,
  lat: row.lat,
  lon: row.lon,
  kabupaten: row.kabupaten,
  address: row.address,
  openHours: parseOpenHours(row.open_hours),
  description: row.description,
  managerName: row.manager_name,
  managerRole: row.manager_role,
  contactWa: row.contact_wa,
  evidenceUrl: row.evidence_url,
  createdAt: row.created_at.toISOString(),
  reviewedAt: row.reviewed_at?.toISOString() ?? null,
  reviewNote: row.review_note,
  destination: row.destination_slug ? { slug: row.destination_slug, name: row.destination_name ?? row.destination_slug } : null,
});

const point = (lon: string, lat: string) =>
  `extensions.st_setsrid(extensions.st_makepoint(${lon}, ${lat}), 4326)::extensions.geography`;

// ---------------------------------------------------------------------------------------------
// Pengguna
// ---------------------------------------------------------------------------------------------

export function createSubmission(userId: string, input: SubmissionInput): Promise<Submission> {
  return withUser(userId, async (client) => {
    const near = await client.query<{ name: string; distance_m: number }>(
      `select name, extensions.st_distance(location, ${point("$1", "$2")}) as distance_m
       from destinations
       where extensions.st_dwithin(location, ${point("$1", "$2")}, $3)
       order by distance_m limit 1`,
      [input.lon, input.lat, DUPLICATE_RADIUS_M],
    );
    if (near.rows[0]) {
      throw new ApiError(
        "VALIDATION_ERROR",
        `Sudah ada destinasi "${near.rows[0].name}" sekitar ${Math.round(near.rows[0].distance_m)} m dari titik ini. ` +
          "Bila itu tempat yang sama, tidak perlu diusulkan lagi.",
      );
    }

    const { rows } = await client.query<{ id: string }>(
      `insert into destination_submissions
         (user_id, name, category, is_indoor, location, kabupaten, address, open_hours, description,
          manager_name, manager_role, contact_wa, evidence_url, consent_at)
       values ($1, $2, $3, $4, ${point("$5", "$6")}, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, now())
       returning id`,
      [
        userId, input.name, input.category, input.isIndoor, input.lon, input.lat, input.kabupaten, input.address,
        input.openHours === null ? null : JSON.stringify(input.openHours),
        input.description, input.managerName, input.managerRole, input.contactWa, input.evidenceUrl,
      ],
    );
    const created = await client.query<SubmissionRow>(`select ${COLUMNS} ${FROM} where s.id = $1`, [rows[0].id]);
    return toSubmission(created.rows[0]);
  });
}

export function listMySubmissions(userId: string): Promise<Submission[]> {
  return withUser(userId, async (client) => {
    const { rows } = await client.query<SubmissionRow>(`select ${COLUMNS} ${FROM} order by s.created_at desc`);
    return rows.map(toSubmission);
  });
}

/** Menarik usulan yang masih menunggu. RLS hanya mengizinkan milik sendiri dan berstatus menunggu. */
export function deleteMySubmission(userId: string, submissionId: string): Promise<void> {
  return withUser(userId, async (client) => {
    const { rowCount } = await client.query("delete from destination_submissions where id = $1", [submissionId]);
    if (!rowCount) throw new ApiError("NOT_FOUND", "Usulan tidak ditemukan atau sudah ditinjau");
  });
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

export async function isAdmin(userId: string): Promise<boolean> {
  const { rowCount } = await getPool().query("select 1 from admins where user_id = $1", [userId]);
  return (rowCount ?? 0) > 0;
}

export async function requireAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) throw new ApiError("NOT_FOUND", "Halaman tidak ditemukan");
}

export type ReviewItem = Submission & {
  submitterEmail: string | null;
  suggestedSlug: string;
  /** Destinasi yang sudah ada di sekitar titik (kandidat duplikat). */
  nearby: { slug: string; name: string; distanceM: number }[];
  /** Wilayah cuaca milik destinasi terdekat; admin boleh menggantinya. */
  suggestedRegion: { adm4Code: string; desa: string; kecamatan: string; kabupaten: string; distanceM: number } | null;
  /** Wilayah perairan milik pantai terdekat (khusus kategori pantai). */
  suggestedMarineArea: string | null;
};

export type ReviewReference = {
  regions: { adm4Code: string; desa: string; kecamatan: string; kabupaten: string }[];
  marineAreas: { code: string; name: string }[];
};

export async function listPendingForReview(adminId: string): Promise<ReviewItem[]> {
  await requireAdmin(adminId);
  const pool = getPool();
  const { rows } = await pool.query<SubmissionRow & { submitter_email: string | null }>(
    `select ${COLUMNS}, u.email as submitter_email ${FROM}
     left join auth.users u on u.id = s.user_id
     where s.status = 'menunggu' order by s.created_at`,
  );

  return Promise.all(
    rows.map(async (row): Promise<ReviewItem> => {
      const target = [row.lon, row.lat];
      const [nearby, region, marine] = await Promise.all([
        pool.query<{ slug: string; name: string; distance_m: number }>(
          `select slug, name, extensions.st_distance(location, ${point("$1", "$2")}) as distance_m
           from destinations where extensions.st_dwithin(location, ${point("$1", "$2")}, $3)
           order by distance_m limit 5`,
          [...target, REVIEW_NEARBY_RADIUS_M],
        ),
        pool.query<{ adm4_code: string; desa: string; kecamatan: string; kabupaten: string; distance_m: number }>(
          `select d.adm4_code, r.desa, r.kecamatan, r.kabupaten,
                  extensions.st_distance(d.location, ${point("$1", "$2")}) as distance_m
           from destinations d join regions r on r.adm4_code = d.adm4_code
           order by distance_m limit 1`,
          target,
        ),
        row.category === "pantai"
          ? pool.query<{ marine_area_code: string }>(
              `select marine_area_code from destinations
               where category = 'pantai' and marine_area_code is not null
                 and extensions.st_dwithin(location, ${point("$1", "$2")}, $3)
               order by extensions.st_distance(location, ${point("$1", "$2")}) limit 1`,
              [...target, MARINE_SUGGEST_RADIUS_M],
            )
          : Promise.resolve({ rows: [] as { marine_area_code: string }[] }),
      ]);

      const nearest = region.rows[0];
      return {
        ...toSubmission(row),
        submitterEmail: row.submitter_email,
        suggestedSlug: slugify(row.name),
        nearby: nearby.rows.map((n) => ({ slug: n.slug, name: n.name, distanceM: Math.round(n.distance_m) })),
        suggestedRegion: nearest
          ? { adm4Code: nearest.adm4_code, desa: nearest.desa, kecamatan: nearest.kecamatan, kabupaten: nearest.kabupaten, distanceM: Math.round(nearest.distance_m) }
          : null,
        suggestedMarineArea: marine.rows[0]?.marine_area_code ?? null,
      };
    }),
  );
}

/** Riwayat keputusan terbaru. Nomor WA sengaja tidak disertakan: tinjauan sudah selesai. */
export async function listRecentlyReviewed(adminId: string, limit = 15): Promise<Submission[]> {
  await requireAdmin(adminId);
  const { rows } = await getPool().query<SubmissionRow>(
    `select ${COLUMNS} ${FROM} where s.status <> 'menunggu' order by s.reviewed_at desc nulls last limit $1`,
    [limit],
  );
  return rows.map((row) => ({ ...toSubmission(row), contactWa: null }));
}

export async function getReviewReference(adminId: string): Promise<ReviewReference> {
  await requireAdmin(adminId);
  const pool = getPool();
  const [regions, marineAreas] = await Promise.all([
    pool.query<{ adm4_code: string; desa: string; kecamatan: string; kabupaten: string }>(
      "select adm4_code, desa, kecamatan, kabupaten from regions order by kabupaten, kecamatan, desa",
    ),
    pool.query<{ code: string; name: string }>("select code, name from marine_areas order by code"),
  ]);
  return {
    regions: regions.rows.map((r) => ({ adm4Code: r.adm4_code, desa: r.desa, kecamatan: r.kecamatan, kabupaten: r.kabupaten })),
    marineAreas: marineAreas.rows,
  };
}

export const approvalSchema = z.object({
  slug: z.string({ error: "Slug wajib diisi" }).regex(/^[a-z0-9-]{1,80}$/, "Slug hanya huruf kecil, angka, dan tanda hubung (maksimal 80)"),
  adm4Code: z.string({ error: "Pilih wilayah cuaca" }).regex(/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/, "Pilih wilayah cuaca"),
  marineAreaCode: z
    .string()
    .regex(/^[A-Z]\.[A-Z]{1,2}\.\d{2}$/, "Kode wilayah perairan tidak valid")
    .nullable(),
  isIndoor: z.boolean(),
  /** Admin menegaskan jam buka sudah dikonfirmasi ke pengelola; menentukan verified_at. */
  hoursVerified: z.boolean(),
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter").nullable(),
});
export type ApprovalDecision = z.infer<typeof approvalSchema>;

export const rejectionNoteSchema = z
  .string({ error: "Alasan penolakan wajib diisi" })
  .trim()
  .min(5, "Alasan penolakan minimal 5 karakter")
  .max(500, "Alasan penolakan maksimal 500 karakter");

function mapApprovalError(error: unknown): unknown {
  const pg = error as { code?: string; constraint?: string };
  if (pg?.code === "23505") return new ApiError("VALIDATION_ERROR", "Slug itu sudah dipakai destinasi lain. Ganti slug-nya.");
  if (pg?.code === "23503") {
    return new ApiError("VALIDATION_ERROR", pg.constraint?.includes("marine") ? "Wilayah perairan tidak dikenal" : "Wilayah cuaca tidak dikenal");
  }
  return error;
}

/** Menyetujui usulan: membuat destinasi (origin 'usulan') dan menandai usulan, dalam satu transaksi. */
export async function approveSubmission(
  adminId: string,
  submissionId: string,
  decision: ApprovalDecision,
): Promise<{ destinationId: string; slug: string }> {
  await requireAdmin(adminId);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const locked = await client.query<{ category: DestCategory }>(
      "select category from destination_submissions where id = $1 and status = 'menunggu' for update",
      [submissionId],
    );
    if (!locked.rows[0]) throw new ApiError("NOT_FOUND", "Usulan tidak ditemukan atau sudah ditinjau");
    if (decision.marineAreaCode && locked.rows[0].category !== "pantai") {
      throw new ApiError("VALIDATION_ERROR", "Wilayah perairan hanya untuk kategori pantai");
    }

    const inserted = await client.query<{ id: string }>(
      `insert into destinations
         (slug, name, category, is_indoor, adm4_code, location, open_hours, description, osm_ref,
          verified_at, marine_area_code, origin)
       select $2::text, s.name, s.category, $3::boolean, $4::text, s.location, s.open_hours, s.description, null::text,
              case when $5::boolean and s.open_hours is not null then (now() at time zone 'Asia/Jakarta')::date end,
              $6::text, 'usulan'
       from destination_submissions s where s.id = $1
       returning id`,
      [submissionId, decision.slug, decision.isIndoor, decision.adm4Code, decision.hoursVerified, decision.marineAreaCode],
    );
    const destinationId = inserted.rows[0].id;

    await client.query(
      `update destination_submissions
       set status = 'disetujui', reviewed_at = now(), reviewed_by = $2, review_note = $3, destination_id = $4
       where id = $1`,
      [submissionId, adminId, decision.note, destinationId],
    );
    await client.query("commit");
    return { destinationId, slug: decision.slug };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw mapApprovalError(error);
  } finally {
    client.release();
  }
}

/** Menolak usulan. Nomor WA dikosongkan (minimisasi data) karena tidak ada tindak lanjut. */
export async function rejectSubmission(adminId: string, submissionId: string, note: string): Promise<void> {
  await requireAdmin(adminId);
  const { rowCount } = await getPool().query(
    `update destination_submissions
     set status = 'ditolak', reviewed_at = now(), reviewed_by = $2, review_note = $3, contact_wa = null
     where id = $1 and status = 'menunggu'`,
    [submissionId, adminId, note],
  );
  if (!rowCount) throw new ApiError("NOT_FOUND", "Usulan tidak ditemukan atau sudah ditinjau");
}
