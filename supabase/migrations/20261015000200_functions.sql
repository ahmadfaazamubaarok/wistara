-- Fungsi SQL untuk query spasial (Rancangan Teknis: facilities_near,
-- indoor_alternatives, destinations_in_bbox). Semua pemanggilan PostGIS diberi
-- awalan schema `extensions` agar tidak bergantung pada search_path pemanggil.

create or replace function facilities_near(
  dest_id uuid,
  radius_m integer,
  types facility_type[] default null
)
returns table (
  id bigint,
  type facility_type,
  name text,
  lat double precision,
  lon double precision,
  distance_m integer
)
language sql stable
as $$
  select
    f.id,
    f.type,
    f.name,
    extensions.st_y(f.location::extensions.geometry) as lat,
    extensions.st_x(f.location::extensions.geometry) as lon,
    round(extensions.st_distance(f.location, d.location))::integer as distance_m
  from destinations d
  join facilities f on extensions.st_dwithin(f.location, d.location, radius_m)
  where d.id = dest_id
    and (types is null or f.type = any (types))
  order by extensions.st_distance(f.location, d.location), f.id
$$;

-- Kandidat alternatif: destinasi indoor lain dalam radius, terdekat lebih dulu.
-- Penyaringan jam buka dan skor dilakukan di TypeScript karena skor dihitung di sana.
create or replace function indoor_alternatives(
  dest_id uuid,
  radius_m integer default 15000
)
returns table (
  id uuid,
  slug text,
  name text,
  category dest_category,
  adm4_code text,
  lat double precision,
  lon double precision,
  open_hours jsonb,
  distance_m integer
)
language sql stable
as $$
  select
    d.id,
    d.slug,
    d.name,
    d.category,
    d.adm4_code,
    extensions.st_y(d.location::extensions.geometry) as lat,
    extensions.st_x(d.location::extensions.geometry) as lon,
    d.open_hours,
    round(extensions.st_distance(d.location, o.location))::integer as distance_m
  from destinations o
  join destinations d
    on d.is_indoor
   and d.id <> o.id
   and extensions.st_dwithin(d.location, o.location, radius_m)
  where o.id = dest_id
  order by extensions.st_distance(d.location, o.location), d.slug
$$;

create or replace function destinations_in_bbox(
  min_lon double precision,
  min_lat double precision,
  max_lon double precision,
  max_lat double precision
)
returns table (id uuid, slug text)
language sql stable
as $$
  select d.id, d.slug
  from destinations d
  where extensions.st_intersects(
    d.location,
    extensions.st_makeenvelope(min_lon, min_lat, max_lon, max_lat, 4326)::extensions.geography
  )
$$;
