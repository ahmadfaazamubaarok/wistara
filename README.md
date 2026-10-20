# Wistara

Aplikasi web yang memberi tahu wisatawan **kapan waktu terbaik** mengunjungi 20 destinasi di DIY dalam 3 hari ke depan, apa saja fasilitas di sekitarnya, dan ke mana kalau hujan. Dilengkapi asisten **Wistara AI** untuk bertanya dengan bahasa sehari-hari. MVP untuk UINIC 8.0 (online paling lambat 30 Oktober 2026).

> **Soal nama.** Nama produknya **Wistara**. "JelajahLokal" adalah nama sementara dan masih muncul di nama berkas dokumen lama (PRD, Rancangan Teknis, DESIGN), nama basis data dev (`jelajahlokal`), dan nama paket di `package.json`. Itu hanya identitas teknis dan belum diganti agar migrasi dan basis data yang sudah ada tidak rusak.

Dokumen acuan:
[PRD](<PRD JelajahLokal (MVP UINIC 8.0).md>) ·
[Rancangan Teknis](<Rancangan Teknis JelajahLokal (MVP UINIC 8.0).md>) ·
[Keunggulan Wistara vs Platform Lain](KEUNGGULAN_WISTARA.md) ·
[Sistem desain](DESIGN-jelajahlokal.md) ·
[Rancangan Wistara AI](<Rancangan Wistara AI (Asisten Rencana).md>)

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL + PostGIS · Supabase Auth (GoTrue) · MapLibre · Zod + OpenAPI · Vitest · Google Gemini (opsional, hanya untuk Wistara AI). Produksi di Vercel + Supabase; Docker hanya untuk pengembangan lokal.

## Fitur

| | Fitur |
| --- | --- |
| F1–F3 | Peta dan daftar 20 destinasi, prakiraan BMKG per 3 jam, **skor kelayakan 0–100** per slot (hujan, angin, panas, jarak pandang) dengan alasan |
| F4–F6 | Fasilitas sekitar (OpenStreetMap), halte/stasiun terdekat, alternatif ruang tertutup saat hujan |
| F7 | Rencana kunjungan berlogin (simpan destinasi + slot; skor dihitung ulang dari prakiraan terbaru), dengan dialog konfirmasi sebelum menghapus (bottom sheet di ponsel) |
| F8–F9 | Transparansi sumber dan kesegaran data, halaman metodologi skor, API publik dengan dokumentasi OpenAPI di `/api/docs` |
| F10 | Banner **peringatan dini cuaca BMKG** (CAP) bila destinasi berada di wilayah terdampak |
| F11 | Destinasi terbaik lintas daftar untuk satu slot waktu (pemilih jam di beranda, `GET /api/v1/recommendations`) |
| F12 | Prakiraan maritim BMKG (gelombang, arus, angin) & kerangka keselamatan pantai (`GET .../sea` & `GET .../safety`) |
| Tambahan | **Wistara AI**, mode gelap, informasi praktis destinasi (tiket, tips, sorotan). Wistara AI berada di luar PRD MVP dan harus ditulis demikian di proposal |

Halaman: `/` (peta + daftar + panel Wistara AI), `/destinasi/[slug]`, `/rencana`, `/masuk`, `/tentang-data`, `/api/docs`.

## Menjalankan (Windows dan Ubuntu sama)

Satu-satunya kebutuhan di komputer Anda adalah Docker. Node.js tidak perlu dipasang.

| | Windows 10/11 | Ubuntu |
| --- | --- | --- |
| Pasang | [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) dengan backend **WSL2**. Di PowerShell *Administrator*: `wsl --install --no-distribution`, lalu restart | [Docker Engine + plugin Compose](https://docs.docker.com/engine/install/ubuntu/), lalu `sudo usermod -aG docker $USER` dan login ulang |
| Cek | `docker compose version` | `docker compose version` |

```bash
git clone https://github.com/alelkohan/wistara.git && cd wistara
docker compose up --build
```

Pertama kali butuh beberapa menit (unduh image, `npm install`, migrasi, dan memuat data seed otomatis). Setelah log menampilkan `Ready`:

- http://localhost:3000 : aplikasi
- http://localhost:3000/api/docs : dokumentasi API interaktif (OpenAPI 3.1)
- http://localhost:3000/api/v1/health : status DB dan kesegaran data BMKG

`.env` **tidak wajib**; salin `.env.example` hanya bila ingin mengubah nilai. Untuk uji login, daftar lewat `/masuk` (konfirmasi email dimatikan di lokal). Tanpa `AI_API_KEY`, Wistara AI tetap menjawab memakai mesin kode; hanya perapian kalimat oleh model yang mati.

## Layanan di compose.yaml

| Layanan | Fungsi |
| --- | --- |
| `app` | Next.js dev (webpack + polling). Menjalankan migrasi dan seed otomatis saat start |
| `db` | PostgreSQL 17 + PostGIS. Skrip `docker/db/init` meniru bagian Supabase (schema, role) |
| `auth` | GoTrue = perangkat lunak yang sama dengan Supabase Auth |
| `gateway` | nginx kecil yang menambahkan awalan `/auth/v1` agar URL sama dengan Supabase |

## Konfigurasi (`.env`)

Semua opsional di lokal. Daftar lengkap dan komentarnya ada di [.env.example](.env.example).

| Variabel | Fungsi |
| --- | --- |
| `APP_PORT`, `APP_BIND`, `DB_PORT` | Port dan alamat bind di host |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Style peta (bawaan OpenFreeMap) |
| `CRON_SECRET` | Rahasia endpoint `/api/cron/refresh` (wajib di produksi) |
| `BMKG_API_BASE_URL` | Mengganti alamat API BMKG (untuk uji ketahanan) |
| `AI_API_KEY`, `AI_MODEL` | Kunci dan nama model Gemini untuk Wistara AI. **Rahasia**: isi hanya di `.env` dan env Vercel, jangan di-commit, jangan berawalan `NEXT_PUBLIC_` |
| `AI_RATE_GUEST_PER_HOUR`, `AI_RATE_USER_PER_HOUR`, `AI_DAILY_LIMIT` | Batas pertanyaan per jam (tamu / pengguna login) dan batas harian seluruh aplikasi |

## Wistara AI

Prinsip: **kode memutuskan, model hanya memahami dan merapikan.** Pemilihan destinasi, skor, jam, jarak, dan susunan rencana dihitung dari data sistem; model bahasa tidak pernah menjadi sumber angka atau fakta.

```
pertanyaan -> pemahaman (kode, + model bila kode belum yakin) -> mesin deterministik
           -> jawaban dasar -> (opsional) dirapikan model -> validator -> respons
```

- **Mengenali destinasi** dari nama tidak baku dan salah ketik ("desa tembi", "kraton", "ulen sentalu"); tempat di luar katalog dijawab "belum ada di katalog" dan tidak pernah dialihkan diam-diam ke destinasi lain.
- **Memahami waktu**: hari, jam, "besok siang", nama hari, weekend. Di luar prakiraan 3 hari dijawab jujur.
- **Jenis jawaban**: rekomendasi (dengan preferensi teduh/hujan/keluarga/sunset/murah), perbandingan, info (lokasi, jam buka, tiket, fasilitas, cuaca, tips), penjelasan skor, alternatif saat hujan, **rencana 1 hari** (otomatis, atau sesuai destinasi, urutan, dan waktu yang diminta; konflik seperti tempat tutup dikatakan terus terang), bantuan aplikasi.
- **Jujur bila data tidak ada**: tiket, fasilitas, atau prakiraan yang tidak tercatat dinyatakan tidak ada. Gelombang/berenang, penginapan, transportasi, keramaian, dan kuliner ditolak sopan; keselamatan pantai tidak pernah dinyatakan aman atau tidak.
- **Pertanyaan lanjutan** ("yang kedua jauh nggak?", "harga per orangnya berapa tuh") memakai hasil jawaban sebelumnya.
- **Validator**: teks model dibuang bila memuat angka atau nama destinasi di luar fakta, tautan, atau markup; jawaban deterministik dipakai.
- **Keamanan dan biaya**: kunci hanya di server dan dikirim lewat header; batas per jam dan harian; setelah HTTP 429/503 model dilewati sementara; teks percakapan tidak disimpan (log hanya metadata).
- Kode ada di `src/lib/ai/`; endpoint `POST /api/v1/assistant` dan `POST /api/v1/assistant/save-itinerary`.

## Perintah harian

Jalankan dari root repository; sama persis di PowerShell dan bash.

| Tujuan | Perintah |
| --- | --- |
| Nyalakan / matikan | `docker compose up` / `docker compose down` (data tetap) |
| Log aplikasi | `docker compose logs -f app` |
| Tes unit (cepat, tanpa DB) | `docker compose exec app npm test` |
| Tes integrasi (DB uji `jelajahlokal_test`, dibuat ulang tiap kali) | `docker compose exec app npm run test:int` |
| Lint dan tipe | `docker compose exec app npm run lint` · `... npm run typecheck` |
| Build produksi | `docker compose exec app npm run build` (lihat peringatan di Pemecahan masalah) |
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
src/components/                     komponen UI (home, destination, trips, map, auth, about)
src/lib/scoring/                    fungsi skor murni + jam buka (teruji)
src/lib/forecast/                   slot berskor, alternatif saat hujan
src/lib/bmkg/, src/lib/weather/     klien BMKG (prakiraan dan CAP), parser, "refresh saat dibaca"
src/lib/ai/                         Wistara AI: resolver nama, waktu, maksud, mesin, penyusun rencana, validator, klien Gemini
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
| Browser tidak pernah memanggil Auth/BMKG/Overpass/Gemini | Login lewat Server Action + cookie `httpOnly`; pemanggilan model dari server; CSP hanya mengizinkan domain peta |
| Slot dicocokkan lewat irisan waktu terbesar | Grid 3 jam BMKG bergeser 1 jam antar-wilayah (00,03,.. vs 01,04,..) |
| Scalar disalin ke `public/vendor` | Komponen React-nya butuh >10 menit kompilasi dev; juga tanpa CDN pihak ketiga |
| CSP memakai `'unsafe-inline'` untuk script | Data hidrasi Next tanpa nonce; peningkatan ke CSP ber-nonce = pekerjaan lanjutan |
| Wistara AI: kode memutuskan, model merapikan | JSON Schema hanya menjamin bentuk, bukan kebenaran; angka dan nama destinasi divalidasi sebelum ditampilkan |

Asumsi desain yang harus ditulis jujur di proposal: ambang dan bobot skor, jendela kunjungan 06.00–18.00 untuk destinasi tanpa jam buka, aturan "slot buka bila jam mulainya di dalam jam buka", perkiraan waktu tempuh (jarak garis lurus × 1,4, 30 km/jam), dan atribut destinasi (teduh, spot senja) di `src/lib/ai/attributes.ts` yang masih tulisan tim dan belum terverifikasi.

## Deploy (Vercel + Supabase)

1. Buat proyek Supabase; jalankan isi `supabase/migrations/*.sql` berurutan (atau `supabase db push`), lalu `npm run db:seed` dengan `DATABASE_URL` proyek tersebut.
2. Variabel di Vercel: `DATABASE_URL` (pooler Supabase), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CRON_SECRET` (acak, ≥16 karakter), `NEXT_PUBLIC_MAP_STYLE_URL`. Untuk Wistara AI: `AI_API_KEY`, `AI_MODEL`, dan batas pemakaian (opsional).
3. `vercel.json` menjadwalkan `/api/cron/refresh` harian; endpoint itu menyegarkan prakiraan dan menyinkronkan peringatan dini BMKG (Hobby: sekali sehari, bisa meleset sampai 59 menit; pengiriman cron best-effort, jadi "refresh saat dibaca" tetap pengaman utama).
4. Konfirmasi email di Supabase aktif secara bawaan; formulir daftar sudah menangani kasus itu.

## Pemecahan masalah

- **`wsl --install` tampak macet di 0%.** Tunggu beberapa menit; bila tetap macet, restart lalu ulangi dengan `--web-download`.
- **Hot reload lambat di Windows.** Clone repo ke dalam filesystem WSL2 (`\\wsl$\Ubuntu\home\<nama>\wistara`).
- **Port 3000/5432/54321 terpakai.** Ubah `APP_PORT`/`DB_PORT` di `.env`.
- **Ubuntu: `Permission denied` menulis `package-lock.json`.** Isi `DEV_UID`/`DEV_GID` di `.env` dengan `id -u`/`id -g`, lalu `docker compose build`.
- **Mengubah skrip `docker/db/init` tidak berpengaruh.** Skrip hanya berjalan saat volume DB dibuat: `docker compose down -v`.
- **Uji dari ponsel.** `APP_BIND=0.0.0.0` dan `NEXT_ALLOWED_DEV_ORIGINS=<IP laptop>` di `.env`.
- **Galat aneh di dev (500 "Unexpected end of JSON input", error React `use()`, hot reload putus).** Folder `.next` rusak atau bercampur build produksi. Jangan menjalankan `npm run build` di container `app` saat dev berjalan. Perbaiki dengan `docker compose exec app sh -c 'rm -rf .next/*'` lalu `docker compose restart app`.
- **Wistara AI menjawab dengan templat, bukan kalimat model.** Cek `docker compose logs app | grep "\[ai\]"`: `HTTP 429` berarti kuota Gemini habis (model dilewati otomatis sekitar satu menit), dan kosongnya `AI_API_KEY` mematikan perapian model. Fungsi inti tetap berjalan.
- **Git Bash di Windows mengubah argumen berawalan `/`** (mis. `/tmp/x` menjadi path Windows). Bungkus dengan `sh -c '...'` atau pakai PowerShell.

## Status

**Sudah:** F1–F12, Wistara AI, mode gelap, dialog konfirmasi hapus.

**Terverifikasi** di Windows 10 + Docker Desktop: compose, tes unit dan tes integrasi (jalankan perintah di atas untuk jumlah terkini), lint, typecheck, build produksi, header CSP produksi, alur login → simpan rencana → hapus → keluar di browser, dan panel Wistara AI di browser. Tes integrasi memuat satu tes batas laju (30 penulisan per menit) yang pernah gagal sekali karena bergantung pada batas menit; lulus saat diulang.

**Belum terbukti:**
- Diuji di **Ubuntu**, **Lighthouse**/aksesibilitas, dan **Vercel/Supabase sungguhan**.
- Jalur **model Gemini** pada Wistara AI diuji dengan tiruan; pengujian langsung terhambat kuota (HTTP 429). Jalur mesin kode (tanpa model) sudah diuji penuh.
- Sinkronisasi peringatan dini ke RSS BMKG sungguhan baru diuji dengan fixture.

**Data yang perlu tindak lanjut tim:** jam buka 20 dari 20 destinasi belum diverifikasi ke pengelola; koordinat Taman Sari, Nglanggeran, dan Pentingsari adalah perkiraan (OSM tak punya objeknya); fasilitas OSM di pantai dan desa wisata jarang; atribut destinasi untuk Wistara AI belum terverifikasi; dengan radius alternatif 15 km, pantai di selatan tak akan pernah mendapat saran museum.

**Belum dikerjakan:** F13 dan di atasnya (P2: rekomendasi personal, ulasan, jadwal Trans Jogja, multi-kota, PWA), pergantian nama internal dari `jelajahlokal` ke `wistara`, dan set uji pertanyaan penuh untuk Wistara AI.
