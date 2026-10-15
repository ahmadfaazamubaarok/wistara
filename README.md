# JelajahLokal

Aplikasi web yang memberi tahu wisatawan kapan waktu terbaik mengunjungi destinasi di DIY dalam 3 hari ke depan, fasilitas di sekitarnya, dan ke mana kalau hujan. MVP untuk UINIC 8.0 (online paling lambat 30 Oktober 2026).

Dokumen acuan: [PRD](<PRD JelajahLokal (MVP UINIC 8.0).md>), [Rancangan Teknis](<Rancangan Teknis JelajahLokal (MVP UINIC 8.0).md>), [sistem desain](DESIGN-jelajahlokal.md).

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL + PostGIS · Supabase Auth (GoTrue) · MapLibre · Zod + OpenAPI · Vitest. Produksi di Vercel + Supabase; Docker hanya untuk pengembangan lokal.

## Menjalankan (Windows dan Ubuntu sama)

Satu-satunya kebutuhan di komputer Anda adalah Docker. Node.js tidak perlu dipasang.

| | Windows 10/11 | Ubuntu |
| --- | --- | --- |
| Pasang | [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) dengan backend **WSL2**. Di PowerShell *Administrator*: `wsl --install --no-distribution`, lalu restart | [Docker Engine + plugin Compose](https://docs.docker.com/engine/install/ubuntu/), lalu `sudo usermod -aG docker $USER` dan login ulang |
| Cek | `docker compose version` | `docker compose version` |

```bash
git clone <url-repo> wistara && cd wistara
docker compose up --build
```

Pertama kali butuh beberapa menit (unduh image, `npm install`, migrasi, dan memuat data seed otomatis). Setelah log menampilkan `Ready`:

- http://localhost:3000 : aplikasi
- http://localhost:3000/api/docs : dokumentasi API interaktif (OpenAPI 3.1)
- http://localhost:3000/api/v1/health : status DB dan kesegaran data BMKG

`.env` **tidak wajib**; salin `.env.example` hanya bila ingin mengubah nilai. Untuk uji login, daftar lewat `/masuk` (konfirmasi email dimatikan di lokal).

> **Pertama kali saja:** `package-lock.json` dibuat oleh `npm install` pertama. Orang yang menjalankannya lebih dulu **harus meng-commit file itu segera** agar versi paket kalian sama.

## Layanan di compose.yaml

| Layanan | Fungsi |
| --- | --- |
| `app` | Next.js dev (webpack + polling). Menjalankan migrasi dan seed otomatis saat start |
| `db` | PostgreSQL 17 + PostGIS. Skrip `docker/db/init` meniru bagian Supabase (schema, role) |
| `auth` | GoTrue = perangkat lunak yang sama dengan Supabase Auth |
| `gateway` | nginx kecil yang menambahkan awalan `/auth/v1` agar URL sama dengan Supabase |

## Perintah harian

Jalankan dari root repository; sama persis di PowerShell dan bash.

| Tujuan | Perintah |
| --- | --- |
| Nyalakan / matikan | `docker compose up` / `docker compose down` (data tetap) |
| Log aplikasi | `docker compose logs -f app` |
| Tes unit (cepat, tanpa DB) | `docker compose exec app npm test` |
| Tes integrasi (DB uji `jelajahlokal_test`, dibuat ulang tiap kali) | `docker compose exec app npm run test:int` |
| Lint dan tipe | `docker compose exec app npm run lint` · `... npm run typecheck` |
| Build produksi | `docker compose exec app npm run build` |
| Terapkan migrasi / muat ulang seed | `... npm run db:migrate` · `... npm run db:seed` |
| psql | `docker compose exec db psql -U wistara -d jelajahlokal` |
| **Reset total** (hapus DB dan node_modules) | `docker compose down -v` |

Setelah `git pull`: `docker compose restart app` (dependensi dan migrasi baru diterapkan otomatis). Menambah paket: `docker compose exec app npm install nama-paket`, lalu commit `package.json` dan `package-lock.json`.

## Struktur folder

```
compose.yaml, Dockerfile, docker/   lingkungan dev (app, db, auth, gateway)
supabase/migrations/                skema SQL (format sama dengan Supabase CLI)
supabase/seed/                      data seed: 20 destinasi, wilayah, fasilitas OSM, daftar kode wilayah
scripts/                            migrasi, seed, dan skrip impor sekali jalan (BMKG/OSM)
src/app/                            halaman dan route handler (api/v1/*, api/docs, api/cron)
src/lib/scoring/                    fungsi skor murni + jam buka (teruji)
src/lib/forecast/                   slot berskor, alternatif saat hujan
src/lib/bmkg/, src/lib/weather/     klien BMKG, parser, layanan "refresh saat dibaca"
src/lib/trips/, src/lib/auth/       rencana kunjungan (RLS), login
src/test/                           tes integrasi (DB sungguhan)
```

## Keputusan teknis penting

| Pilihan | Alasan |
| --- | --- |
| `next dev --webpack` + polling, bukan Turbopack | Bind mount NTFS tidak meneruskan event file; Turbopack tak punya opsi polling |
| TypeScript `~5.9`, ESLint `^9` | `typescript-eslint` belum mendukung TS 7; plugin React belum mendukung ESLint 10 |
| Container berzona **UTC** | Vercel berjalan di UTC; tampilan WIB dikonversi eksplisit (`src/lib/wib.ts`) |
| RLS di **semua** tabel, bukan hanya `trips` | Anon key Supabase publik; tanpa RLS siapa pun bisa menulis lewat PostgREST |
| Browser tidak pernah memanggil Auth/BMKG/Overpass | Login lewat Server Action + cookie `httpOnly`; CSP hanya mengizinkan domain peta |
| Slot dicocokkan lewat irisan waktu terbesar | Grid 3 jam BMKG bergeser 1 jam antar-wilayah (00,03,.. vs 01,04,..) |
| Scalar disalin ke `public/vendor` | Komponen React-nya butuh >10 menit kompilasi dev; juga tanpa CDN pihak ketiga |
| CSP memakai `'unsafe-inline'` untuk script | Data hidrasi Next tanpa nonce; peningkatan ke CSP ber-nonce = pekerjaan lanjutan |

Asumsi desain yang harus ditulis jujur di proposal: ambang dan bobot skor, jendela kunjungan 06.00–18.00 untuk destinasi tanpa jam buka, dan aturan "slot buka bila jam mulainya di dalam jam buka".

## Deploy (Vercel + Supabase)

1. Buat proyek Supabase; jalankan isi `supabase/migrations/*.sql` berurutan (atau `supabase db push`), lalu `npm run db:seed` dengan `DATABASE_URL` proyek tersebut.
2. Variabel di Vercel: `DATABASE_URL` (pooler Supabase), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CRON_SECRET` (acak, ≥16 karakter), `NEXT_PUBLIC_MAP_STYLE_URL`.
3. `vercel.json` sudah menjadwalkan `/api/cron/refresh` harian (Hobby: sekali sehari, bisa meleset sampai 59 menit; pengiriman cron best-effort, jadi "refresh saat dibaca" tetap pengaman utama).
4. Konfirmasi email di Supabase aktif secara bawaan; formulir daftar sudah menangani kasus itu.

## Pemecahan masalah

- **`wsl --install` tampak macet di 0%.** Tunggu beberapa menit; bila tetap macet, restart lalu ulangi dengan `--web-download`.
- **Hot reload lambat di Windows.** Clone repo ke dalam filesystem WSL2 (`\\wsl$\Ubuntu\home\<nama>\wistara`).
- **Port 3000/5432/54321 terpakai.** Ubah `APP_PORT`/`DB_PORT` di `.env`.
- **Ubuntu: `Permission denied` menulis `package-lock.json`.** Isi `DEV_UID`/`DEV_GID` di `.env` dengan `id -u`/`id -g`, lalu `docker compose build`.
- **Mengubah skrip `docker/db/init` tidak berpengaruh.** Skrip hanya berjalan saat volume DB dibuat: `docker compose down -v`.
- **Uji dari ponsel.** `APP_BIND=0.0.0.0` dan `NEXT_ALLOWED_DEV_ORIGINS=<IP laptop>` di `.env`.
- **Git Bash di Windows mengubah argumen berawalan `/`** (mis. `/tmp/x` menjadi path Windows). Bungkus dengan `sh -c '...'` atau pakai PowerShell.

## Status

Sudah: F1–F9 (peta, prakiraan, skor, fasilitas, alternatif hujan, akses, rencana kunjungan + login, transparansi data, API + OpenAPI). Belum: F10 dan F11 (P1).

Terverifikasi di Windows 10 + Docker Desktop 4.95: compose, 132 tes unit, 140 tes integrasi, lint, typecheck, build produksi, header CSP produksi, dan alur login → simpan rencana → keluar di browser. **Belum diuji di Ubuntu**, di Lighthouse, dan di Vercel/Supabase sungguhan.

Data yang perlu tindak lanjut tim: jam buka 20 dari 20 destinasi belum diverifikasi ke pengelola; koordinat Taman Sari, Nglanggeran, dan Pentingsari adalah perkiraan (OSM tak punya objeknya); fasilitas OSM di pantai dan desa wisata jarang; dengan radius alternatif 15 km, pantai di selatan tak akan pernah mendapat saran museum.
