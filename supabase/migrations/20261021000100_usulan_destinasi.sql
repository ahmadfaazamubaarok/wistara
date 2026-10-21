-- F13: usulan destinasi dari pengelola, dan peran admin untuk meninjaunya.
--
-- PRINSIP: usulan TIDAK PERNAH langsung tayang. Usulan masuk tabel terpisah dan baru menjadi baris
-- di `destinations` setelah disetujui admin, karena koordinat dan jam buka memengaruhi skor cuaca
-- (dan, untuk pantai, informasi keselamatan). Nomor WA pengusul adalah data pribadi: hanya pemilik
-- usulan dan admin yang bisa membacanya, dan tidak pernah dikirim lewat API publik.

-- Asal baris destinasi. `db:seed` hanya boleh menghapus baris asal 'seed'; destinasi dari usulan
-- yang sudah disetujui tidak boleh hilang saat seed dijalankan ulang.
alter table destinations
  add column origin text not null default 'seed' check (origin in ('seed', 'usulan'));

-- Admin = pengguna yang boleh meninjau usulan. Diisi lewat `npm run admin:grant -- <email>`.
-- Hanya server yang membacanya, jadi anon/authenticated tidak diberi hak apa pun.
create table admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;
revoke all on admins from anon, authenticated;

create type submission_status as enum ('menunggu', 'disetujui', 'ditolak');

create table destination_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  status submission_status not null default 'menunggu',

  name text not null check (char_length(name) between 3 and 80),
  category dest_category not null,
  is_indoor boolean not null default false,
  location extensions.geography(point, 4326) not null,
  kabupaten text not null check (kabupaten in ('Kota Yogyakarta', 'Sleman', 'Bantul', 'Kulon Progo', 'Gunungkidul')),
  address text not null check (char_length(address) between 10 and 300),
  open_hours jsonb,                       -- format sama dengan destinations.open_hours; NULL = tanpa batas jam
  description text check (description is null or char_length(description) <= 600),

  manager_name text not null check (char_length(manager_name) between 2 and 100),
  manager_role text not null check (manager_role in ('pengelola', 'pemilik', 'pemdes', 'komunitas', 'lainnya')),
  -- Dinormalkan ke awalan 62 tanpa plus (mis. 6281234567890). Dikosongkan saat usulan ditolak.
  contact_wa text check (contact_wa is null or contact_wa ~ '^62[0-9]{8,13}$'),
  evidence_url text check (evidence_url is null or evidence_url ~ '^https?://[^[:space:]]{3,290}$'),
  consent_at timestamptz not null,        -- persetujuan pengusul atas penggunaan kontaknya untuk verifikasi

  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  destination_id uuid references destinations on delete set null  -- terisi saat disetujui
);
create index submissions_status_idx on destination_submissions (status, created_at);
create index submissions_user_idx on destination_submissions (user_id, created_at desc);

-- Batas per pengguna di tingkat basis data. Berjalan sebagai pemanggil sehingga RLS berlaku:
-- yang dihitung hanya usulan milik pengguna itu.
create function enforce_submissions_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from destination_submissions where status = 'menunggu') >= 5 then
    raise exception 'Maksimal 5 usulan yang masih menunggu ditinjau' using errcode = 'P0001', hint = 'LIMIT_SUBMISSIONS';
  end if;
  return new;
end $$;
create trigger submissions_limit before insert on destination_submissions
  for each row execute function enforce_submissions_limit();

-- Row Level Security: pengguna hanya melihat, membuat, dan menarik usulannya sendiri. Tidak ada hak
-- UPDATE, jadi pengguna tidak bisa mengubah status atau catatan peninjauan. Admin bekerja lewat
-- koneksi server (bukan role authenticated).
alter table destination_submissions enable row level security;

create policy own_submissions_select on destination_submissions for select to authenticated
  using (user_id = auth.uid());

create policy own_submissions_insert on destination_submissions for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'menunggu'
    and reviewed_at is null and reviewed_by is null and review_note is null and destination_id is null
  );

-- Usulan hanya bisa ditarik selama masih menunggu.
create policy own_submissions_delete on destination_submissions for delete to authenticated
  using (user_id = auth.uid() and status = 'menunggu');

revoke all on destination_submissions from anon, authenticated;
grant select, insert, delete on destination_submissions to authenticated;
