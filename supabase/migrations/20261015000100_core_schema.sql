-- Skema inti JelajahLokal (Rancangan Teknis, bagian "Model data").
-- Tabel trips/trip_items ada di migrasi terpisah karena bergantung pada auth.users.

create extension if not exists postgis schema extensions;

create type dest_category as enum ('pantai', 'alam', 'budaya', 'museum', 'desa_wisata');
create type facility_type as enum ('toilet', 'parkir', 'makan', 'ibadah', 'atm', 'halte', 'stasiun');

create table regions (
  adm4_code text primary key,            -- kode desa/kelurahan, mis. '34.02.03.2002'; divalidasi lewat API BMKG
  desa text not null,
  kecamatan text not null,
  kabupaten text not null
);

create table destinations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{1,80}$'),
  name text not null,
  category dest_category not null,
  is_indoor boolean not null default false,
  adm4_code text not null references regions,
  location extensions.geography(point, 4326) not null,
  open_hours jsonb,                      -- {"mon":["08:00","16:00"], ...}; hari tanpa kunci = tutup; NULL = tanpa batas jam
  description text,
  osm_ref text,                          -- 'way/123456'
  verified_at date                       -- NULL = jam buka belum diverifikasi ke pengelola
);
create index destinations_location_idx on destinations using gist (location);
create index destinations_category_idx on destinations (category);

create table facilities (
  id bigserial primary key,
  osm_type text not null,
  osm_id bigint not null,
  type facility_type not null,
  name text,
  location extensions.geography(point, 4326) not null,
  tags jsonb,
  fetched_at timestamptz not null default now(),
  unique (osm_type, osm_id)
);
create index facilities_location_idx on facilities using gist (location);
create index facilities_type_idx on facilities (type);

create table forecasts (
  adm4_code text not null references regions,
  valid_at timestamptz not null,         -- dari utc_datetime BMKG
  local_time timestamp not null,         -- dari local_datetime BMKG (WIB, tanpa zona)
  t numeric,                             -- suhu, derajat C
  hu numeric,                            -- kelembapan, %
  ws numeric,                            -- kecepatan angin, km/jam
  wd text,                               -- arah angin
  tcc numeric,                           -- tutupan awan, %
  vs_text text,                          -- jarak pandang (teks); NULL saat cerah
  weather_desc text,
  analysis_date timestamptz not null,    -- waktu produksi prakiraan oleh BMKG
  fetched_at timestamptz not null default now(),
  primary key (adm4_code, valid_at)
);

create table forecast_fetches (
  adm4_code text primary key references regions,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_status int,
  last_error text
);

create table score_profiles (
  category dest_category primary key,
  w_rain numeric not null check (w_rain >= 0),
  w_wind numeric not null check (w_wind >= 0),
  w_heat numeric not null check (w_heat >= 0),
  w_vis numeric not null check (w_vis >= 0)
);

-- Keamanan: anon key Supabase bersifat publik di browser, dan PostgREST
-- membuka seluruh skema public dengannya. Karena itu RLS dinyalakan di SEMUA
-- tabel, bukan hanya trips. Data referensi hanya boleh dibaca, tidak ditulis.
alter table regions enable row level security;
alter table destinations enable row level security;
alter table facilities enable row level security;
alter table forecasts enable row level security;
alter table forecast_fetches enable row level security;
alter table score_profiles enable row level security;

create policy regions_public_read on regions for select to anon, authenticated using (true);
create policy destinations_public_read on destinations for select to anon, authenticated using (true);
create policy facilities_public_read on facilities for select to anon, authenticated using (true);
create policy forecasts_public_read on forecasts for select to anon, authenticated using (true);
create policy score_profiles_public_read on score_profiles for select to anon, authenticated using (true);
-- forecast_fetches sengaja tanpa policy: hanya server (peran pemilik tabel) yang boleh mengakses.

revoke insert, update, delete, truncate on
  regions, destinations, facilities, forecasts, forecast_fetches, score_profiles
  from anon, authenticated;
revoke all on forecast_fetches from anon, authenticated;
