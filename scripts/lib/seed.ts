// Memuat data seed (supabase/seed/*.json) ke database. Idempoten (upsert).
// Dipakai oleh CLI (scripts/db-seed.ts) dan oleh tes integrasi.
// Data fasilitas © OpenStreetMap contributors (ODbL).

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Client } from "pg";
import { z } from "zod";
import { openHoursSchema } from "../../src/lib/scoring/open-hours";

export const SEED_DIR = path.resolve(process.cwd(), "supabase/seed");
const BATCH = 1000;

const regionSchema = z.object({
  adm4Code: z.string().regex(/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/),
  desa: z.string().min(1),
  kecamatan: z.string().min(1),
  kabupaten: z.string().min(1),
});

const destinationSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  name: z.string().min(1),
  category: z.enum(["pantai", "alam", "budaya", "museum", "desa_wisata"]),
  isIndoor: z.boolean(),
  adm4Code: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  openHours: openHoursSchema.nullable(),
  description: z.string().nullable(),
  osmRef: z.string().nullable(),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  marineAreaCode: z.string().nullable().optional(),
});

const beachSafetySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  swimStatus: z.enum(["dilarang", "zona_terbatas", "belum_diverifikasi"]).default("belum_diverifikasi"),
  hazards: z.array(z.string()).default([]),
  sarPostName: z.string().nullable().optional(),
  sarPostLocation: z.object({ lat: z.number(), lon: z.number() }).nullable().optional(),
  guardHours: z.record(z.string(), z.array(z.string())).nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  incidentRefs: z.array(z.any()).default([]),
  sourceUrl: z.string().url("sourceUrl harus berupa URL valid"),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "verifiedAt harus format YYYY-MM-DD"),
});

const facilitySchema = z.object({
  osmType: z.string(),
  osmId: z.number().int(),
  type: z.enum(["toilet", "parkir", "makan", "ibadah", "atm", "halte", "stasiun"]),
  name: z.string().nullable(),
  lat: z.number(),
  lon: z.number(),
  tags: z.record(z.string(), z.string()),
});

async function readSeed<T extends z.ZodType>(file: string, schema: T): Promise<z.infer<T>[]> {
  const raw = JSON.parse(await readFile(path.join(SEED_DIR, file), "utf8"));
  return z.array(schema).parse(raw);
}

export type SeedCounts = { regions: number; destinations: number; facilities: number; beachSafeties: number };

export async function loadSeed(client: Client): Promise<SeedCounts> {
  const regions = await readSeed("regions.json", regionSchema);
  const destinations = await readSeed("destinations.json", destinationSchema);
  const facilities = await readSeed("facilities.json", facilitySchema);
  const beachSafeties = await readSeed("beach-safety.json", beachSafetySchema);

  const known = new Set(regions.map((r) => r.adm4Code));
  for (const d of destinations) {
    if (!known.has(d.adm4Code)) {
      throw new Error(`Destinasi ${d.slug} merujuk wilayah ${d.adm4Code} yang tidak ada di regions.json`);
    }
    if (d.marineAreaCode && d.category !== "pantai") {
      throw new Error(`Destinasi ${d.slug} bukan kategori pantai tapi memiliki marineAreaCode "${d.marineAreaCode}"`);
    }
  }

  await client.query("begin");
  try {
    await client.query(
      `insert into regions (adm4_code, desa, kecamatan, kabupaten)
       select * from unnest($1::text[], $2::text[], $3::text[], $4::text[])
       on conflict (adm4_code) do update
         set desa = excluded.desa, kecamatan = excluded.kecamatan, kabupaten = excluded.kabupaten`,
      [regions.map((r) => r.adm4Code), regions.map((r) => r.desa), regions.map((r) => r.kecamatan), regions.map((r) => r.kabupaten)],
    );

    for (const d of destinations) {
      await client.query(
        `insert into destinations
           (slug, name, category, is_indoor, adm4_code, location, open_hours, description, osm_ref, verified_at, marine_area_code)
         values ($1, $2, $3, $4, $5,
                 extensions.st_setsrid(extensions.st_makepoint($6, $7), 4326)::extensions.geography,
                 $8::jsonb, $9, $10, $11, $12)
         on conflict (slug) do update set
           name = excluded.name, category = excluded.category, is_indoor = excluded.is_indoor,
           adm4_code = excluded.adm4_code, location = excluded.location, open_hours = excluded.open_hours,
           description = excluded.description, osm_ref = excluded.osm_ref, verified_at = excluded.verified_at,
           marine_area_code = excluded.marine_area_code`,
        [d.slug, d.name, d.category, d.isIndoor, d.adm4Code, d.lon, d.lat,
         d.openHours === null ? null : JSON.stringify(d.openHours), d.description, d.osmRef, d.verifiedAt, d.marineAreaCode ?? null],
      );
    }

    for (const b of beachSafeties) {
      const { rows } = await client.query<{ id: string }>(
        "select id from destinations where slug = $1",
        [b.slug],
      );
      if (!rows[0]) throw new Error(`Destinasi untuk beach_safety "${b.slug}" tidak ditemukan`);
      const destId = rows[0].id;
      const sarLoc = b.sarPostLocation
        ? `extensions.st_setsrid(extensions.st_makepoint(${b.sarPostLocation.lon}, ${b.sarPostLocation.lat}), 4326)::extensions.geography`
        : null;

      await client.query(
        `insert into beach_safety
           (destination_id, swim_status, hazards, sar_post_name, sar_post_location,
            guard_hours, emergency_contact, notes, incident_refs, source_url, verified_at)
         values ($1, $2::swim_status, $3, $4,
                 ${sarLoc ? `extensions.st_setsrid(extensions.st_makepoint($5, $6), 4326)::extensions.geography` : `null`},
                 $7::jsonb, $8, $9, $10::jsonb, $11, $12)
         on conflict (destination_id) do update set
           swim_status = excluded.swim_status, hazards = excluded.hazards,
           sar_post_name = excluded.sar_post_name, sar_post_location = excluded.sar_post_location,
           guard_hours = excluded.guard_hours, emergency_contact = excluded.emergency_contact,
           notes = excluded.notes, incident_refs = excluded.incident_refs,
           source_url = excluded.source_url, verified_at = excluded.verified_at`,
        [
          destId,
          b.swimStatus,
          b.hazards,
          b.sarPostName ?? null,
          b.sarPostLocation?.lon ?? null,
          b.sarPostLocation?.lat ?? null,
          b.guardHours ? JSON.stringify(b.guardHours) : null,
          b.emergencyContact ?? null,
          b.notes ?? null,
          JSON.stringify(b.incidentRefs),
          b.sourceUrl,
          b.verifiedAt,
        ],
      );
    }

    for (let i = 0; i < facilities.length; i += BATCH) {
      const chunk = facilities.slice(i, i + BATCH);
      await client.query(
        `insert into facilities (osm_type, osm_id, type, name, location, tags)
         select t.osm_type, t.osm_id, t.type::facility_type, t.name,
                extensions.st_setsrid(extensions.st_makepoint(t.lon, t.lat), 4326)::extensions.geography,
                t.tags::jsonb
         from unnest($1::text[], $2::bigint[], $3::text[], $4::text[], $5::float8[], $6::float8[], $7::text[])
           as t(osm_type, osm_id, type, name, lon, lat, tags)
         on conflict (osm_type, osm_id) do update set
           type = excluded.type, name = excluded.name, location = excluded.location,
           tags = excluded.tags, fetched_at = now()`,
        [
          chunk.map((f) => f.osmType), chunk.map((f) => f.osmId), chunk.map((f) => f.type),
          chunk.map((f) => f.name), chunk.map((f) => f.lon), chunk.map((f) => f.lat),
          chunk.map((f) => JSON.stringify(f.tags)),
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  return { regions: regions.length, destinations: destinations.length, facilities: facilities.length, beachSafeties: beachSafeties.length };
}
