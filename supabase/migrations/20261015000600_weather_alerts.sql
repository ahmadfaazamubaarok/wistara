-- Skema tabel weather_alerts untuk Peringatan Dini Cuaca Ekstrem (PRD F10).
-- Format data mengacu pada OASIS Common Alerting Protocol (CAP) v1.2 yang diterbitkan BMKG.

create table if not exists weather_alerts (
  cap_id text primary key,
  identifier text not null,
  sender text not null,
  sent timestamptz not null,
  status text not null default 'Actual',
  msg_type text not null default 'Alert',
  scope text not null default 'Public',
  event text not null,
  urgency text,
  severity text,
  certainty text,
  headline text,
  description text not null,
  instruction text,
  effective timestamptz not null,
  expires timestamptz not null,
  area_desc text not null,
  polygon extensions.geography(geometry, 4326),
  adm_kecamatan text[] default '{}',
  ref_identifier text,
  created_at timestamptz not null default now(),
  fetched_at timestamptz not null default now()
);

-- Indeks untuk pencarian alert aktif berdasarkan rentang waktu
create index if not exists weather_alerts_active_idx on weather_alerts (effective, expires);

-- Indeks spasial GIST untuk pencocokan poligon jika ada
create index if not exists weather_alerts_polygon_idx on weather_alerts using gist (polygon);

-- RLS: Seluruh pengguna publik dapat membaca peringatan dini cuaca aktif
alter table weather_alerts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'weather_alerts' and policyname = 'weather_alerts_public_read'
  ) then
    create policy weather_alerts_public_read on weather_alerts for select using (true);
  end if;
end $$;

grant select on weather_alerts to anon, authenticated;
