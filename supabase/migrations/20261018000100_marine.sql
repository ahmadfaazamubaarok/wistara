-- Migrasi data maritim BMKG dan kerangka keselamatan pantai (Wistara v0.2).
-- Mencakup: marine_areas, marine_forecasts, marine_fetches, beach_safety, dan kolom destinations.marine_area_code.

create table marine_areas (
  code text primary key check (code ~ '^[A-Z]\.[A-Z]{1,2}\.\d{2}$|^M\.\d{2}$'),
  name text not null
);

alter table destinations
  add column marine_area_code text references marine_areas;

create table marine_forecasts (
  area_code text not null references marine_areas,
  valid_at timestamptz not null,
  resolution_minutes int not null check (resolution_minutes in (60, 180)),
  wave_cat text,
  wave_height numeric,
  wind_from text,
  wind_speed_kt numeric,
  wind_gust_kt numeric,
  current_to text,
  current_speed_kt numeric,
  weather text,
  issued_at timestamptz not null,
  station_name text,
  fetched_at timestamptz not null default now(),
  primary key (area_code, valid_at)
);

create table marine_fetches (
  area_code text primary key references marine_areas,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_status int,
  last_error text
);

create type swim_status as enum ('dilarang', 'zona_terbatas', 'belum_diverifikasi');

create table beach_safety (
  destination_id uuid primary key references destinations on delete cascade,
  swim_status swim_status not null default 'belum_diverifikasi',
  hazards text[] not null default '{}',
  sar_post_name text,
  sar_post_location extensions.geography(point, 4326),
  guard_hours jsonb,
  emergency_contact text,
  notes text,
  incident_refs jsonb not null default '[]',
  source_url text not null,
  verified_at date not null
);

create index destinations_marine_area_code_idx on destinations (marine_area_code);
create index marine_forecasts_valid_at_idx on marine_forecasts (valid_at);
create index beach_safety_swim_status_idx on beach_safety (swim_status);

-- Data awal wilayah maritim DIY (P.N.01, P.N.02, P.N.03)
insert into marine_areas (code, name) values
  ('P.N.01', 'Perairan Kulonprogo'),
  ('P.N.02', 'Perairan Bantul'),
  ('P.N.03', 'Perairan Gunungkidul')
on conflict (code) do update set name = excluded.name;

-- Keamanan RLS & hak akses
alter table marine_areas enable row level security;
alter table marine_forecasts enable row level security;
alter table marine_fetches enable row level security;
alter table beach_safety enable row level security;

create policy marine_areas_public_read on marine_areas for select to anon, authenticated using (true);
create policy marine_forecasts_public_read on marine_forecasts for select to anon, authenticated using (true);
create policy beach_safety_public_read on beach_safety for select to anon, authenticated using (true);
-- marine_fetches sengaja tanpa policy: hanya server (peran pemilik tabel) yang boleh mengakses.

revoke all on marine_areas, marine_forecasts, marine_fetches, beach_safety from anon, authenticated;
grant select on marine_areas, marine_forecasts, beach_safety to anon, authenticated;
