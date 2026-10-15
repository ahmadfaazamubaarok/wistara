-- Hanya untuk DEV LOKAL. Meniru bagian lingkungan Supabase yang dipakai skema
-- proyek, supaya file di supabase/migrations/ bisa dijalankan apa adanya di
-- lokal maupun di proyek Supabase sungguhan (di sana semua ini sudah tersedia).
--
-- Skrip ini hanya berjalan saat volume DB pertama kali dibuat. Direktori ini
-- sengaja di-mount menggantikan /docker-entrypoint-initdb.d milik image PostGIS,
-- agar PostGIS tidak ikut terpasang di schema public dan topology/tiger
-- geocoder tidak membengkakkan DB.

create schema if not exists extensions;
create schema if not exists auth;

create extension if not exists postgis schema extensions;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  -- GoTrue memberi hak ke role bawaan Supabase `postgres` pada beberapa migrasinya.
  if not exists (select from pg_roles where rolname = 'postgres') then
    create role postgres nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;

  -- Supabase menaruh extensions di search_path; skema proyek mengandalkannya.
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
end
$$;

-- Server Next.js terhubung sebagai superuser lokal dan memakai
-- `set local role authenticated` untuk menegakkan RLS, seperti di Supabase.
grant anon, authenticated, service_role to current_user;

grant usage on schema public, extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- Supabase memberi anon/authenticated/service_role SEMUA hak pada tabel baru di schema
-- public (default privileges); yang melindungi data adalah RLS dan REVOKE di migrasi.
-- Ditiru di sini agar tes keamanan lokal mencerminkan produksi: tanpa ini, hak tulis
-- "ditolak" hanya karena hak bawaannya kosong, bukan karena migrasi kita benar.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Pemilik schema auth untuk GoTrue (layanan Auth lokal, setara Supabase Auth). GoTrue
-- membuat tabel auth.users dan lainnya sendiri lewat migrasinya saat pertama berjalan.
-- Kata sandi ini khusus dev lokal dan harus sama dengan GOTRUE_DB_DATABASE_URL di compose.yaml.
do $$
begin
  if not exists (select from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login noinherit createrole password 'auth_dev_password';
  end if;
  execute format('grant create on database %I to supabase_auth_admin', current_database());
end
$$;
alter schema auth owner to supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
grant usage on schema extensions to supabase_auth_admin;


-- CATATAN: auth.uid() dan auth.role() sengaja TIDAK didefinisikan di sini. GoTrue membuatnya
-- sendiri pada migrasi pertamanya (seperti di Supabase), dan akan gagal ("must be owner of
-- function uid") bila fungsi itu sudah dimiliki role lain. Database uji, yang tidak memakai
-- GoTrue, mendefinisikannya di src/test/global-setup.ts.
