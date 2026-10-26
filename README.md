# Wistara

Aplikasi web yang memberi tahu wisatawan **kapan waktu terbaik** mengunjungi 365 destinasi di DIY dalam 3 hari ke depan, apa saja fasilitas di sekitarnya, bagaimana status gelombang bila itu pantai, dan ke mana kalau hujan. Dilengkapi asisten **Wistara AI** untuk bertanya dengan bahasa sehari-hari. MVP untuk UINIC 8.0 (online paling lambat 30 Oktober 2026).

> **Soal nama.** Nama produknya **Wistara**. "JelajahLokal" adalah nama sementara dan masih muncul di nama berkas dokumen lama (PRD, Rancangan Teknis, DESIGN), nama basis data dev (`jelajahlokal`), dan nama paket di `package.json`. Itu hanya identitas teknis dan belum diganti agar migrasi dan basis data yang sudah ada tidak rusak.

> **Catatan desain.** Dokumen rancangan awal dan spesifikasi internal diarsipkan secara terpisah. **README ini merupakan acuan utama fitur dan implementasi proyek.**

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL + PostGIS · Supabase Auth (GoTrue) · MapLibre · Zod + OpenAPI · Vitest · Google Gemini (opsional, hanya untuk Wistara AI). Produksi di Vercel + Supabase; Docker hanya untuk pengembangan lokal.

## Fitur

| | Fitur |
| --- | --- |
| F1–F3 | Peta dan daftar 365 destinasi, prakiraan BMKG per 3 jam, **skor kelayakan 0–100** per slot (hujan, angin, panas, jarak pandang) dengan alasan |
| F4–F6 | Fasilitas sekitar (OpenStreetMap, radius 500 m, 1 km, 2 km), halte/stasiun terdekat, alternatif ruang tertutup saat hujan. Tautan keluar ke **Google Maps** dari halaman destinasi: profil tempat (ulasan dan foto), rute pribadi, dan rute kendaraan umum (Wistara hanya menautkan; data transitnya milik Google) |
| F7 | Rencana kunjungan berlogin (simpan destinasi + slot; skor dihitung ulang dari prakiraan terbaru), dengan dialog konfirmasi sebelum menghapus (bottom sheet di ponsel) |
| F8–F9 | Transparansi sumber dan kesegaran data, halaman metodologi skor dengan kalkulator contoh interaktif (`/tentang-data`), API publik dengan dokumentasi OpenAPI di `/api/docs` (daftar endpoint di bawah) |
| F10 | Banner **peringatan dini cuaca BMKG** (CAP) bila destinasi berada di wilayah terdampak |
| F11 | Destinasi terbaik lintas daftar untuk satu slot waktu (pemilih jam di beranda, `GET /api/v1/recommendations`) |
| F12 | Prakiraan maritim BMKG (gelombang, arus, angin) & kerangka keselamatan pantai (`GET .../sea` & `GET .../safety`) |
| Tambahan | **Wistara AI**, mode gelap, informasi praktis destinasi (tiket, tips, sorotan), **usulan destinasi dari pengelola** dengan panel tinjauan admin. Wistara AI dan usulan destinasi berada di luar PRD MVP dan harus ditulis demikian di proposal |

Halaman: `/` (peta + daftar + panel Wistara AI), `/destinasi/[slug]`, `/rencana`, `/masuk`, `/tentang-data`, `/api/docs`, `/usul` (formulir usulan, perlu login), `/admin/usulan` (khusus admin).

## API publik

Spesifikasi OpenAPI di `/api/openapi.json`, dokumentasi interaktif di `/api/docs`. Galat memakai bentuk seragam `{"error": {"code", "message"}}` (400, 401, 404, 429, 500, 503). Endpoint data publik (destinasi, prakiraan, laut, fasilitas, alternatif, rekomendasi, peringatan) memakai cache CDN; `health`, rencana, dan Wistara AI tidak di-cache. Endpoint rencana memakai `Authorization: Bearer <access_token>` dan dibatasi per pengguna.

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/v1/destinations` | Daftar destinasi (filter kategori, nama, area peta) |
| `GET /api/v1/destinations/{slug}` | Detail destinasi |
| `GET /api/v1/destinations/{slug}/forecast` | Prakiraan BMKG per slot 3 jam beserta skor kelayakan dan alasannya |
| `GET /api/v1/destinations/{slug}/sea` | Prakiraan maritim BMKG per slot 3 jam (hanya pantai) |
| `GET /api/v1/destinations/{slug}/safety` | Data kurasi keselamatan pantai (hanya pantai; `verified: false` bila belum dikurasi) |
| `GET /api/v1/destinations/{slug}/facilities` | Fasilitas sekitar, terdekat lebih dulu (radius 100–3000 m) |
| `GET /api/v1/destinations/{slug}/alternatives` | Alternatif ruang tertutup saat cuaca buruk |
| `GET /api/v1/recommendations` | Destinasi terbaik lintas daftar untuk satu slot |
| `GET /api/v1/alerts` | Peringatan dini cuaca aktif BMKG (CAP) |
| `GET /api/v1/health` | Status layanan: database, kesegaran data BMKG darat dan maritim |
| `GET/POST /api/v1/trips`, `PATCH/DELETE /api/v1/trips/{id}`, `POST /api/v1/trips/{id}/items`, `DELETE /api/v1/trips/{id}/items/{itemId}` | Rencana kunjungan milik pengguna (login, RLS) |
| `POST /api/v1/assistant`, `POST /api/v1/assistant/save-itinerary` | Wistara AI. **Tidak masuk OpenAPI.** Tamu atau pengguna login, dibatasi per jam |
| `GET /api/cron/refresh` | Pemanasan data BMKG. Bukan API publik: butuh `Authorization: Bearer <CRON_SECRET>` |

**Usulan destinasi tidak punya REST API**; ia berjalan lewat Server Action dari halaman `/usul` dan `/admin/usulan`.

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
| `GEOCODER_BASE_URL` | Layanan saran alamat dari peta pada formulir usulan. Kosong = Nominatim publik (OpenStreetMap, 1 permintaan/detik untuk semua pemakai); untuk beban besar arahkan ke instance sendiri |
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
- **Jujur bila data tidak ada**: tiket, fasilitas, atau prakiraan yang tidak tercatat dinyatakan tidak ada. Penginapan, transportasi, keramaian, dan kuliner ditolak sopan. Untuk gelombang dan berenang, AI menyebut bahwa prakiraan gelombang BMKG per wilayah perairan ada di halaman pantai (bukan kondisi di titik pantai tertentu) dan bahwa data arus balik serta kelayakan berenang per pantai belum ada; keselamatan pantai tidak pernah dinyatakan aman atau tidak.
- **Pertanyaan lanjutan** ("yang kedua jauh nggak?", "harga per orangnya berapa tuh") memakai hasil jawaban sebelumnya.
- **Validator**: teks model dibuang bila memuat angka atau nama destinasi di luar fakta, tautan, atau markup; jawaban deterministik dipakai.
- **Keamanan dan biaya**: kunci hanya di server dan dikirim lewat header; batas per jam dan harian; setelah HTTP 429/503 model dilewati sementara; teks percakapan tidak disimpan (log hanya metadata).
- Kode ada di `src/lib/ai/`; endpoint `POST /api/v1/assistant` dan `POST /api/v1/assistant/save-itinerary`.

## Usulan destinasi dan panel admin

Pengelola, pemilik, atau pemerintah desa dapat mengusulkan destinasi lewat `/usul` (perlu login). Hanya wilayah DIY.

- **Usulan tidak pernah langsung tayang.** Masuk tabel `destination_submissions` (status menunggu, disetujui, ditolak). Skor cuaca bergantung pada koordinat dan jam buka, jadi admin memeriksa lebih dulu di `/admin/usulan`. Saat disetujui, baris baru dibuat di `destinations` dengan `origin = 'usulan'`.
- **Lokasi** dipilih dengan klik di peta (atau koordinat manual, atau lokasi perangkat) dan **divalidasi di server** terhadap poligon `supabase/seed/diy-boundary.json`. Titik yang kurang dari 75 m dari destinasi yang sudah ada ditolak sebagai duplikat.
- **Kabupaten/kota dan alamat terisi otomatis saat peta diklik** (reverse geocoding OpenStreetMap lewat Nominatim, dipanggil dari server, `src/lib/geocode/`). Hanya saran: saran **tidak pernah menimpa** isian yang sudah diketik atau dipilih pengguna, dan bila layanan gagal formulir tetap diisi manual. Dibatasi 20 pencarian per pengguna dan 40 per menit global (kebijakan Nominatim publik: maksimal 1 permintaan/detik), dengan cache kecil per instance. Nama kecamatan dari OpenStreetMap kadang kurang tepat, jadi pengusul diminta memeriksanya.
- **Pengusul tidak mengisi kode wilayah cuaca.** Panel admin menyarankan wilayah BMKG dari destinasi terdekat (beserta jaraknya), dan untuk pantai wilayah perairan dari pantai terdekat dalam 5 km. Admin boleh mengganti keduanya.
- **Jam buka**: tanggal verifikasi (`verified_at`) hanya terisi bila admin mencentang bahwa jam buka sudah dikonfirmasi ke pengelola.
- **Nomor WhatsApp pengusul adalah data pribadi**: hanya terbaca oleh pemilik usulan dan admin (RLS), tidak ada di API publik, dan dikosongkan saat usulan ditolak. Formulir meminta persetujuan eksplisit.
- **Pembatas**: 5 usulan menunggu per akun (trigger database) dan 5 pengiriman per jam (`rate_limit_hit`).
- **Admin** = baris di tabel `admins` (tanpa hak akses untuk `anon` maupun `authenticated`). Pemeriksaan ada di layanan (`src/lib/submissions/service.ts`), bukan hanya di halaman; non-admin melihat 404.
- **`db:seed` aman**: hanya menghapus destinasi `origin = 'seed'` yang tak ada di berkas seed, sehingga destinasi dari usulan yang disetujui tidak ikut hilang.

Menjadikan pengguna sebagai admin (pengguna harus sudah mendaftar di `/masuk?mode=daftar`):

```bash
docker compose exec app npm run admin:grant -- email@contoh.com
docker compose exec app npm run admin:grant -- email@contoh.com --revoke
```

Di Supabase produksi, jalankan `npm run admin:grant` dengan `DATABASE_URL` proyek tersebut, atau `insert into admins (user_id) select id from auth.users where email = '...'` di SQL editor.

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
| Jadikan pengguna admin peninjau usulan | `... npm run admin:grant -- email@contoh.com` (tambah `--revoke` untuk mencabut) |
| psql | `docker compose exec db psql -U wistara -d jelajahlokal` |
| **Reset total** (hapus DB dan node_modules) | `docker compose down -v` |

Setelah `git pull`: `docker compose restart app` (dependensi dan migrasi baru diterapkan otomatis). Menambah paket: `docker compose exec app npm install nama-paket`, lalu commit `package.json` dan `package-lock.json`.

## Struktur folder

```
compose.yaml, Dockerfile, docker/   lingkungan dev (app, db, auth, gateway)
supabase/migrations/                skema SQL (format sama dengan Supabase CLI)
supabase/seed/                      data seed: 365 destinasi, wilayah, fasilitas OSM, batas DIY (diy-boundary.json), override wilayah perairan
scripts/                            migrasi, seed, impor sekali jalan (BMKG/OSM), pemetaan wilayah perairan, admin:grant
src/app/                            halaman dan route handler (api/v1/*, api/docs, api/cron, usul, admin/usulan) dan Server Action
src/components/                     komponen UI (home, destination, trips, map, auth, about, submissions)
src/lib/scoring/                    fungsi skor murni + jam buka (teruji)
src/lib/forecast/                   slot berskor, alternatif saat hujan
src/lib/bmkg/, src/lib/weather/     klien BMKG (prakiraan darat, maritim, dan CAP), parser, "refresh saat dibaca"
src/lib/marine/                     status laut per slot (perhatian, waspada, bahaya) dan teks antarmukanya (satu sumber: sea-labels.ts)
src/lib/submissions/, src/lib/geo/, src/lib/geocode/   usulan destinasi: skema, layanan admin, batas DIY, saran alamat dari peta
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
| Status laut adalah indikator **terpisah** dari skor 0–100, dan kata "aman" tidak dipakai | Prakiraan BMKG berlaku per wilayah perairan (P.N.01–03), bukan per pantai, dan berupa prakiraan model; menyebut "aman" menjanjikan sesuatu yang tidak bisa dijamin. Status terendah adalah "perhatian" |
| Usulan destinasi tidak pernah langsung tayang | Koordinat dan jam buka memengaruhi skor; admin memeriksa dulu. Nomor WA pengusul hanya terbaca pemilik dan admin |
| `db:seed` hanya menghapus destinasi `origin = 'seed'` | Destinasi dari usulan yang disetujui tidak ada di berkas seed dan harus bertahan saat seed dijalankan ulang |
| Tidak ada CI; migrasi Supabase diterapkan manual sebelum deploy | Build, lint, dan tes dijalankan lokal; kode yang naik sebelum migrasinya membuat halaman terkait error |

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

**Sudah:** F1–F12, Wistara AI, mode gelap, dialog konfirmasi hapus, usulan destinasi dengan panel admin.

**Terverifikasi** di Windows 10 + Docker Desktop: compose, tes unit dan tes integrasi (jalankan perintah di atas untuk jumlah terkini), lint, typecheck, build produksi, header CSP produksi, alur login → simpan rencana → hapus → keluar di browser, dan panel Wistara AI di browser. Tes integrasi memuat satu tes batas laju (30 penulisan per menit) yang pernah gagal sekali karena bergantung pada batas menit; lulus saat diulang.

**Belum terbukti:**
- Diuji di **Ubuntu** dan **Lighthouse**/aksesibilitas. Produksi di **Vercel + Supabase sudah berjalan** (`/api/v1/health` menjawab OK dengan data BMKG segar pada 21 Okt 2026), tetapi tidak ada CI dan deploy tampaknya manual, jadi migrasi baru harus diterapkan ke Supabase sebelum kode barunya dideploy.
- Jalur **model Gemini** pada Wistara AI diuji dengan tiruan; pengujian langsung terhambat kuota (HTTP 429). Jalur mesin kode (tanpa model) sudah diuji penuh.
- Sinkronisasi peringatan dini ke RSS BMKG sungguhan baru diuji dengan fixture.

**Masalah yang diketahui (kinerja, diukur 21–22 Okt 2026):** beranda di produksi butuh sekitar 6–8 detik sampai selesai dimuat (respons pertama 0,5 detik, hanya 80 KB di jaringan; sisanya waktu server). Penyebab yang terukur: fungsi Vercel berjalan di `iad1` (AS timur) sedangkan pengguna dan database jauh (pengecekan database 1,1 detik); data 365 destinasi dihitung ulang di setiap muat tanpa cache (±2 detik bahkan dengan database lokal); dan data BMKG diperbarui saat dibaca bila lebih tua dari 6 jam, sehingga pengunjung pertama menunggu. Rencana perbaikan: samakan region fungsi dengan region Supabase, cache data beranda 3–5 menit, dan pemanasan data terjadwal (cron Vercel Hobby hanya sekali sehari).

**Data yang perlu tindak lanjut tim:**
- **Jam buka**: hanya 12 dari 365 destinasi yang sudah diverifikasi ke pengelola, dan hanya 20 yang punya jam buka tetap; sisanya memakai jendela kunjungan bawaan 06.00–18.00 (asumsi desain). Jalur usulan destinasi dan centang "jam buka sudah dikonfirmasi" di panel admin dibuat untuk mengisi ini.
- **Data pengayaan** (tiket, tips, sorotan di `src/lib/destination-enrichment.ts`) baru ada untuk 36 destinasi; 329 lainnya hanya memuat nama, kategori, koordinat, dan fasilitas OSM.
- **Koordinat perkiraan**: Taman Sari, Nglanggeran, dan Pentingsari (OSM tak punya objeknya).
- **Kandidat duplikat di seed** yang perlu diputuskan: `ngobaran` dan `pantai-ngobaran`; serta beberapa entri Taman Sari (`taman-sari`, `taman-sari-water-castle`, `water-castle-tamansari`, `pulo-kenanga-highest-building-in-tamansari-ruins`).
- **Kondisi laut**: apakah ambang hembusan angin 25 knot yang menaikkan status satu tingkat dipertahankan (asumsi desain tim, bukan standar BMKG atau SAR); apakah wilayah laut lepas `M.11` perlu diambil untuk banner; isi folder `warning/` pada API maritim BMKG belum diperiksa (bila memuat peringatan gelombang tinggi untuk DIY, laporkan formatnya sebelum diintegrasikan). Pemetaan pantai ke wilayah perairan: 50 dari 50 pantai terpasang; Parangtritis di P.N.02 lewat `supabase/seed/marine-area-overrides.json`.
- Fasilitas OSM di pantai dan desa wisata jarang; atribut destinasi untuk Wistara AI belum terverifikasi; dengan radius alternatif 15 km, pantai di selatan tak akan pernah mendapat saran museum.
- **Saran alamat dari peta** memakai Nominatim publik (1 permintaan/detik untuk semua pemakai) dan nama kecamatannya kadang kurang tepat; untuk beban besar ganti `GEOCODER_BASE_URL`.

**Belum dikerjakan:** rencana lanjutan P2 (rekomendasi personal, ulasan, jadwal Trans Jogja, multi-kota, PWA; di Rancangan Teknis awal rencana ini diberi nomor F12, sedangkan di README nomor F12 dipakai untuk kondisi laut), pergantian nama internal dari `jelajahlokal` ke `wistara`, set uji pertanyaan penuh untuk Wistara AI, dan klaim/pembaruan data destinasi yang sudah ada oleh pengelola (saat ini pengelola hanya bisa mengusulkan destinasi baru).
