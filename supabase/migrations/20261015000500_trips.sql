-- F7: rencana kunjungan milik pengguna, plus penghitung laju untuk endpoint tulis.
-- Bergantung pada auth.users (dibuat GoTrue / Supabase Auth) dan auth.uid().

create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  created_at timestamptz not null default now()
);
create index trips_user_idx on trips (user_id, created_at desc);

create table trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips on delete cascade,
  destination_id uuid not null references destinations,
  planned_slot timestamptz,                  -- awal slot 3 jam yang dipilih; NULL = belum memilih slot
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index trip_items_trip_idx on trip_items (trip_id, position);
-- Satu destinasi + slot yang sama tidak boleh ganda dalam satu rencana (NULL dianggap sama).
create unique index trip_items_unique on trip_items (trip_id, destination_id, planned_slot) nulls not distinct;

-- Batas per pengguna di tingkat basis data, agar tidak bisa dilewati dengan memanggil API langsung.
-- Berjalan sebagai pemanggil sehingga RLS berlaku: yang dihitung hanya baris milik pengguna itu.
create function enforce_trips_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from trips) >= 50 then
    raise exception 'Batas 50 rencana per pengguna tercapai' using errcode = 'P0001', hint = 'LIMIT_TRIPS';
  end if;
  return new;
end $$;
create trigger trips_limit before insert on trips for each row execute function enforce_trips_limit();

create function enforce_trip_items_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from trip_items where trip_id = new.trip_id) >= 30 then
    raise exception 'Batas 30 destinasi per rencana tercapai' using errcode = 'P0001', hint = 'LIMIT_ITEMS';
  end if;
  return new;
end $$;
create trigger trip_items_limit before insert on trip_items for each row execute function enforce_trip_items_limit();

-- Row Level Security: pengguna hanya bisa melihat dan mengubah rencana miliknya, bahkan bila ada
-- bug di API. anon tidak punya akses sama sekali.
alter table trips enable row level security;
alter table trip_items enable row level security;

create policy own_trips on trips for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy own_items on trip_items for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()))
  with check (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()));

revoke all on trips, trip_items from anon, authenticated;
grant select, insert, update, delete on trips, trip_items to authenticated;

-- Penghitung laju (jendela tetap) untuk endpoint tulis. Disimpan di Postgres karena memori
-- fungsi serverless tidak bertahan antar-permintaan. Hanya server yang boleh menyentuhnya.
create table rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

-- Mencatat satu permintaan dan mengembalikan apakah masih diizinkan.
create function rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
returns table (allowed boolean, hits int, retry_after int)
language plpgsql as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  h int;
begin
  insert into rate_limits as r (bucket, window_start, hits) values (p_bucket, w, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into h;

  -- Bersihkan jendela lama sesekali agar tabel tidak membengkak.
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return query select
    h <= p_limit,
    h,
    greatest(1, ceil(extract(epoch from (w + make_interval(secs => p_window_seconds) - now())))::int);
end $$;
