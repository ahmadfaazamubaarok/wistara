// Akses dan penyimpanan data peringatan dini cuaca BMKG (PRD F10).

import { getPool } from "./index";
import type { Destination } from "./destinations";
import type { CapAlert } from "../bmkg/cap-parser";

export type WeatherAlert = {
  capId: string;
  identifier: string;
  event: string;
  headline: string | null;
  description: string;
  instruction: string | null;
  severity: string | null;
  urgency: string | null;
  effective: string;
  expires: string;
  areaDesc: string;
  admKecamatan: string[];
};

type AlertRow = {
  cap_id: string;
  identifier: string;
  event: string;
  headline: string | null;
  description: string;
  instruction: string | null;
  severity: string | null;
  urgency: string | null;
  effective: Date;
  expires: Date;
  area_desc: string;
  adm_kecamatan: string[] | null;
};

function mapAlert(row: AlertRow): WeatherAlert {
  return {
    capId: row.cap_id,
    identifier: row.identifier,
    event: row.event,
    headline: row.headline,
    description: row.description,
    instruction: row.instruction,
    severity: row.severity,
    urgency: row.urgency,
    effective: row.effective.toISOString(),
    expires: row.expires.toISOString(),
    areaDesc: row.area_desc,
    admKecamatan: row.adm_kecamatan ?? [],
  };
}

function parseReferenceIdentifier(refString: string | null): string | null {
  if (!refString) return null;
  // Format standar CAP 1.2: "sender,identifier,sent" (atau daftar dipisah spasi)
  const firstRef = refString.trim().split(/\s+/)[0];
  const parts = firstRef.split(",");
  return parts.length >= 2 ? parts[1].trim() : firstRef;
}

/** Simpan atau perbarui CAP alert di database, termasuk penanganan pesan Update dan Cancel. */
export async function saveWeatherAlert(alert: CapAlert): Promise<void> {
  const pool = getPool();
  const refId = parseReferenceIdentifier(alert.references);

  // Jika pesan bertipe Cancel, batalkan / kadaluarsakan alert yang dirujuk
  if (alert.msgType === "Cancel" && refId) {
    await pool.query(
      `update weather_alerts
       set expires = $1, msg_type = 'Cancel'
       where identifier = $2 or cap_id = $2`,
      [alert.sent, refId],
    );
  }

  // Jika pesan bertipe Update, tandai alert lama yang dirujuk sebagai telah kadaluarsa
  if (alert.msgType === "Update" && refId) {
    await pool.query(
      `update weather_alerts
       set expires = $1
       where (identifier = $2 or cap_id = $2) and cap_id != $3`,
      [alert.sent, refId, alert.capId],
    );
  }

  const sql = `
    insert into weather_alerts (
      cap_id, identifier, sender, sent, status, msg_type, scope,
      event, urgency, severity, certainty, headline, description,
      instruction, effective, expires, area_desc, polygon, adm_kecamatan,
      ref_identifier, fetched_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17,
      case when $18::text is not null then extensions.st_geomfromtext($18, 4326)::extensions.geography else null end,
      $19, $20, now()
    )
    on conflict (cap_id) do update set
      msg_type = excluded.msg_type,
      headline = excluded.headline,
      description = excluded.description,
      instruction = excluded.instruction,
      effective = excluded.effective,
      expires = excluded.expires,
      area_desc = excluded.area_desc,
      polygon = excluded.polygon,
      adm_kecamatan = excluded.adm_kecamatan,
      ref_identifier = excluded.ref_identifier,
      fetched_at = now()
  `;

  await pool.query(sql, [
    alert.capId,
    alert.identifier,
    alert.sender,
    alert.sent,
    alert.status,
    alert.msgType,
    alert.scope,
    alert.event,
    alert.urgency,
    alert.severity,
    alert.certainty,
    alert.headline,
    alert.description,
    alert.instruction,
    alert.effective,
    alert.expires,
    alert.areaDesc,
    alert.polygonWkt,
    alert.admKecamatan,
    refId,
  ]);
}

/** Ambil seluruh alert yang sedang aktif berlaku pada waktu `now`. */
export async function listActiveAlerts(now: Date = new Date()): Promise<WeatherAlert[]> {
  const sql = `
    select cap_id, identifier, event, headline, description, instruction,
           severity, urgency, effective, expires, area_desc, adm_kecamatan
    from weather_alerts
    where effective <= $1 and expires >= $1 and msg_type != 'Cancel'
    order by effective desc
  `;
  const { rows } = await getPool().query<AlertRow>(sql, [now]);
  return rows.map(mapAlert);
}

/**
 * Ambil alert aktif yang berdampak pada kecamatan atau koordinat lokasi destinasi.
 * Pencocokan menggunakan kesesuaian elemen kecamatan yang ketat atau poligon spasial PostGIS,
 * bukan pencarian substring bebas pada deskripsi naratif.
 */
export async function getActiveAlertsForDestination(
  destination: Destination,
  now: Date = new Date(),
): Promise<WeatherAlert[]> {
  const kecamatan = destination.region.kecamatan;

  const sql = `
    select a.cap_id, a.identifier, a.event, a.headline, a.description, a.instruction,
           a.severity, a.urgency, a.effective, a.expires, a.area_desc, a.adm_kecamatan
    from weather_alerts a
    where a.effective <= $1 and a.expires >= $1 and a.msg_type != 'Cancel'
      and (
        -- 1. Kecocokan persis nama kecamatan di dalam array adm_kecamatan (case-insensitive)
        exists (
          select 1 from unnest(a.adm_kecamatan) k
          where lower(trim(k)) = lower(trim($2))
        )
        -- 2. Pencocokan spasial koordinat destinasi di dalam poligon CAP PostGIS
        or (a.polygon is not null and extensions.st_intersects(
          a.polygon,
          extensions.st_setsrid(extensions.st_makepoint($3, $4), 4326)::extensions.geography
        ))
        -- 3. Peringatan menyeluruh tingkat provinsi tanpa batasan kecamatan atau poligon spesifik
        or (
          lower(trim(a.area_desc)) in ('d.i. yogyakarta', 'daerah istimewa yogyakarta', 'diy')
          and cardinality(a.adm_kecamatan) = 0
          and a.polygon is null
        )
      )
    order by a.effective desc
  `;

  const { rows } = await getPool().query<AlertRow>(sql, [now, kecamatan, destination.lon, destination.lat]);
  return rows.map(mapAlert);
}

/** Hapus data alert yang sudah kadaluarsa lebih dari 24 jam. */
export async function cleanupExpiredAlerts(before?: Date): Promise<number> {
  const cutoff = before ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { rowCount } = await getPool().query("delete from weather_alerts where expires < $1", [cutoff]);
  return rowCount ?? 0;
}

/**
 * Buat data alert tiruan untuk keperluan demo juri atau pengujian antarmuka (hanya di mode development).
 */
export function createDemoAlert(destination: Destination, now: Date = new Date()): WeatherAlert {
  const effective = new Date(now.getTime() - 30 * 60 * 1000);
  const expires = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const kecamatan = destination.region.kecamatan;
  const kabupaten = destination.region.kabupaten;

  return {
    capId: `DEMO-ALERT-${destination.slug.toUpperCase()}`,
    identifier: `DEMO-ALERT-${destination.slug}`,
    event: "Peringatan Dini Cuaca Ekstrem",
    headline: `Peringatan Dini Cuaca ${kabupaten}: Hujan Lebat Disertai Petir dan Angin Kencang`,
    description: `Berpotensi terjadi hujan dengan intensitas lebat yang dapat disertai kilat/petir dan angin kencang di wilayah ${kecamatan}, ${kabupaten} dan sekitarnya.`,
    instruction:
      "Wisatawan diimbau untuk berteduh di bangunan permanen yang aman dan menghindari area tebing atau pohon besar.",
    severity: "Severe",
    urgency: "Immediate",
    effective: effective.toISOString(),
    expires: expires.toISOString(),
    areaDesc: `${kabupaten}: ${kecamatan}`,
    admKecamatan: [kecamatan],
  };
}
