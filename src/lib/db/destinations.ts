// Akses data destinasi, profil bobot skor, dan query spasial (PostGIS).
// Semua query memakai parameter terikat ($1, $2, ...); tidak ada interpolasi string.

import { getPool } from "./index";
import type { DestCategory, FacilityType } from "../categories";
import { parseOpenHours, type OpenHours } from "../scoring/open-hours";
import type { ScoreProfile } from "../scoring/score";

export type Destination = {
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
  /** Tanggal jam buka terakhir diverifikasi ke pengelola; null = belum. */
  verifiedAt: string | null;
  region: { desa: string; kecamatan: string; kabupaten: string };
};

type DestinationRow = {
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
  desa: string;
  kecamatan: string;
  kabupaten: string;
};

const SELECT = `
  select d.id, d.slug, d.name, d.category, d.is_indoor, d.adm4_code,
         extensions.st_y(d.location::extensions.geometry) as lat,
         extensions.st_x(d.location::extensions.geometry) as lon,
         d.open_hours, d.description, d.osm_ref,
         to_char(d.verified_at, 'YYYY-MM-DD') as verified_at,
         r.desa, r.kecamatan, r.kabupaten
  from destinations d
  join regions r on r.adm4_code = d.adm4_code`;

function mapDestination(row: DestinationRow): Destination {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    isIndoor: row.is_indoor,
    adm4Code: row.adm4_code,
    lat: row.lat,
    lon: row.lon,
    openHours: parseOpenHours(row.open_hours),
    description: row.description,
    osmRef: row.osm_ref,
    verifiedAt: row.verified_at,
    region: { desa: row.desa, kecamatan: row.kecamatan, kabupaten: row.kabupaten },
  };
}

export type DestinationFilter = {
  categories?: DestCategory[];
  /** Pencarian nama (tanpa membedakan huruf besar/kecil). */
  q?: string;
  /** [minLon, minLat, maxLon, maxLat] */
  bbox?: [number, number, number, number];
};

export async function listDestinations(filter: DestinationFilter = {}): Promise<Destination[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filter.categories?.length) where.push(`d.category = any(${bind(filter.categories)}::dest_category[])`);
  if (filter.q) {
    // Escape karakter khusus LIKE agar "%" dan "_" dari pengguna dibaca apa adanya.
    const escaped = filter.q.replace(/[\\%_]/g, (char) => `\\${char}`);
    where.push(`d.name ilike ${bind(`%${escaped}%`)} escape '\\'`);
  }
  if (filter.bbox) {
    const [a, b, c, d] = filter.bbox.map(bind);
    where.push(`d.id in (select id from destinations_in_bbox(${a}, ${b}, ${c}, ${d}))`);
  }

  const sql = `${SELECT}${where.length ? ` where ${where.join(" and ")}` : ""} order by d.name`;
  const { rows } = await getPool().query<DestinationRow>(sql, params);
  return rows.map(mapDestination);
}

export async function getDestinationBySlug(slug: string): Promise<Destination | null> {
  const { rows } = await getPool().query<DestinationRow>(`${SELECT} where d.slug = $1`, [slug]);
  return rows[0] ? mapDestination(rows[0]) : null;
}

type ProfileRow = { category: DestCategory; w_rain: string; w_wind: string; w_heat: string; w_vis: string };

/** Bobot dibaca dari DB tiap kali, jadi penyetelan tabel langsung berlaku tanpa deploy. */
export async function getScoreProfiles(): Promise<Record<DestCategory, ScoreProfile>> {
  const { rows } = await getPool().query<ProfileRow>(
    "select category, w_rain, w_wind, w_heat, w_vis from score_profiles",
  );
  const profiles = {} as Record<DestCategory, ScoreProfile>;
  for (const row of rows) {
    profiles[row.category] = {
      wRain: Number(row.w_rain),
      wWind: Number(row.w_wind),
      wHeat: Number(row.w_heat),
      wVis: Number(row.w_vis),
    };
  }
  return profiles;
}

export type NearbyFacility = {
  id: number;
  type: FacilityType;
  name: string | null;
  lat: number;
  lon: number;
  distanceM: number;
};

export async function facilitiesNear(
  destinationId: string,
  radiusM: number,
  types?: FacilityType[],
): Promise<NearbyFacility[]> {
  const { rows } = await getPool().query<{
    id: string; type: FacilityType; name: string | null; lat: number; lon: number; distance_m: number;
  }>("select * from facilities_near($1, $2, $3::facility_type[])", [
    destinationId,
    radiusM,
    types?.length ? types : null,
  ]);
  return rows.map((row) => ({
    id: Number(row.id),
    type: row.type,
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    distanceM: row.distance_m,
  }));
}

export type IndoorCandidate = {
  id: string;
  slug: string;
  name: string;
  category: DestCategory;
  adm4Code: string;
  lat: number;
  lon: number;
  openHours: OpenHours | null;
  distanceM: number;
};

export async function indoorCandidates(destinationId: string, radiusM: number): Promise<IndoorCandidate[]> {
  const { rows } = await getPool().query<{
    id: string; slug: string; name: string; category: DestCategory; adm4_code: string;
    lat: number; lon: number; open_hours: unknown; distance_m: number;
  }>("select * from indoor_alternatives($1, $2)", [destinationId, radiusM]);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    adm4Code: row.adm4_code,
    lat: row.lat,
    lon: row.lon,
    openHours: parseOpenHours(row.open_hours),
    distanceM: row.distance_m,
  }));
}
