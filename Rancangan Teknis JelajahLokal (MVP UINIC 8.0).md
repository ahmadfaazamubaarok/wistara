# Rancangan Teknis JelajahLokal (MVP UINIC 8.0)

Oct 15, 2026 · @Rani

## Ringkasan

JelajahLokal menjawab pertanyaan "kapan sebaiknya saya berkunjung, dan apa yang ada di dekatnya?" untuk 20 destinasi pilihan di DIY, dengan skor kelayakan per slot 3 jam selama 3 hari ke depan. Batas pengumpulan proposal, repository, dan website online adalah Jumat, 30 Oktober 2026 pukul 23.59.

**Masalah.** Wisatawan mengecek destinasi, cuaca, fasilitas, dan akses di tempat terpisah, sehingga mudah memilih waktu yang kurang cocok.

**Pembeda utama.** Skor kelayakan kunjungan yang dihitung berbeda untuk tiap jenis destinasi (pantai, alam, budaya terbuka, museum, desa wisata), lengkap dengan alasan yang bisa dibaca, ditambah saran destinasi alternatif saat cuaca buruk. Peta dan daftar fasilitas adalah pendukung, bukan inti.

**Keputusan stack.** Next.js (TypeScript) sebagai frontend sekaligus REST API, Supabase (PostgreSQL + PostGIS + Auth) sebagai basis data, MapLibre GL + OpenFreeMap untuk peta, dan Vercel untuk hosting. Semua komponen punya paket gratis dan bisa dikerjakan dalam satu repository oleh 2 orang.

**Batasan jujur.** Prakiraan BMKG hanya 3 hari, jadi aplikasi ini untuk perencanaan jangka pendek (H-3 sampai hari H). Skor adalah rekomendasi berbasis prakiraan, bukan jaminan kondisi di lokasi.

**Subtema.** Sosial Budaya, dengan landasan SDG target 8.9 tentang pariwisata berkelanjutan yang mempromosikan budaya dan produk lokal.

## Fitur MVP

Sembilan fitur P0 wajib selesai dan ter-deploy paling lambat 24 Oktober, karena pengujian pengguna butuh aplikasi yang sudah bisa dipakai. P1 dikerjakan hanya jika P0 selesai tepat waktu. P2 masuk ke bagian "Saran pengembangan" di proposal.

| Kode | Fitur | Prioritas | Yang dilihat pengguna | Data dari |
| --- | --- | --- | --- | --- |
| F1 | Peta destinasi + filter kategori | P0 | 20 destinasi DIY di peta, filter Pantai, Alam, Budaya, Museum, Desa Wisata | Kurasi tim + koordinat OSM |
| F2 | Prakiraan cuaca per destinasi | P0 | Suhu, kondisi, angin, kelembapan per 3 jam untuk hari ini, besok, lusa | BMKG Prakiraan Cuaca |
| F3 | Skor kelayakan kunjungan | P0 | Strip warna per slot 3 jam (Sangat sesuai, Cukup, Kurang) + alasan singkat | Dihitung dari F2 + profil kategori |
| F4 | Fasilitas sekitar | P0 | Toilet, parkir, tempat makan, masjid, ATM, halte, stasiun dalam radius tertentu, dengan jarak | OSM (impor sekali, disimpan di DB) |
| F5 | Alternatif saat cuaca buruk | P0 | Jika slot dinilai Kurang karena hujan, muncul 3 destinasi indoor terdekat yang skornya lebih baik di slot yang sama | Query PostGIS atas F1 + F3 |
| F6 | Akses dan rute | P0 | Halte/stasiun terdekat + tombol "Buka rute" ke Google Maps | OSM + Google Maps URLs (tanpa API key) |
| F7 | Rencana kunjungan (login) | P0 | Simpan daftar destinasi + slot waktu pilihan, lihat ulang skornya | Supabase Auth + tabel trips |
| F8 | Transparansi data | P0 | Atribusi BMKG dan OSM, waktu produksi prakiraan, label "data lama" bila BMKG gagal diakses, halaman metodologi skor | Metadata dari F2 |
| F9 | API publik + dokumentasi | P0 | Endpoint REST v1 dengan dokumentasi OpenAPI di /api/docs | Semua tabel di atas |
| F10 | Peringatan dini cuaca | P1 | Banner peringatan jika destinasi berada di kecamatan terdampak | BMKG Peringatan Dini (CAP) |
| F11 | Waktu terbaik lintas destinasi | P1 | "Besok pagi, destinasi mana yang paling sesuai?" diurutkan dari skor tertinggi | F3 untuk semua destinasi |
| F12 | Rekomendasi berbasis preferensi (AI), ulasan, jadwal Trans Jogja langsung, tinggi gelombang pantai, multi-kota, PWA | P2 | Tidak dibangun, hanya ditulis sebagai rencana | - |

**Cakupan data MVP.** 20 destinasi di DIY, kira-kira 4 per kategori. Contoh kandidat yang perlu dicek koordinat dan kode wilayahnya antara lain Pantai Parangtritis, Pantai Indrayanti, Gumuk Pasir Parangkusumo, Gunung Api Purba Nglanggeran, Hutan Pinus Mangunan, Keraton Yogyakarta, Taman Sari, Candi Prambanan, Museum Benteng Vredeburg, Museum Sonobudoyo, dan Desa Wisata Pentingsari. Daftar final ditentukan tim.

## Sumber data

Semua sumber di bawah sudah dicek langsung di halaman resminya pada 15 Oktober 2026. Aturan utamanya, setiap data eksternal diambil oleh server, disimpan di database, lalu disajikan dari database. Browser pengguna tidak pernah memanggil BMKG atau Overpass secara langsung.

| Sumber | Dipakai untuk | Cara akses | Batas dan aturan penting |
| --- | --- | --- | --- |
| [BMKG Prakiraan Cuaca](https://data.bmkg.go.id/prakiraan-cuaca/) | F2, F3, F5 | `GET https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode}` (JSON) | 3 hari, per 3 jam, diperbarui 2 kali sehari, tingkat desa/kelurahan, 60 permintaan per menit per IP, wajib mencantumkan BMKG sebagai sumber |
| [BMKG Peringatan Dini Cuaca](https://data.bmkg.go.id/peringatan-dini-cuaca/) | F10 | RSS `https://www.bmkg.go.id/alerts/nowcast/id`, lalu detail CAP XML per provinsi | Format CAP, sampai tingkat kecamatan, ada poligon wilayah terdampak, diperbarui setiap saat, 60 permintaan per menit per IP, wajib atribusi |
| OpenStreetMap via [Overpass API](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) | F1 (koordinat), F4, F6 | Query `around:` per destinasi, dijalankan sekali sebagai skrip impor | Instance publik tidak untuk dijadikan backend aplikasi, panduan kasar sekitar 10.000 permintaan dan 1 GB per hari |
| [Lisensi OSM (ODbL)](https://www.openstreetmap.org/copyright) | Semua data OSM | - | Wajib menampilkan kredit OpenStreetMap dan menjelaskan bahwa datanya berlisensi ODbL |
| [OpenFreeMap](https://openfreemap.org/) | Peta dasar (tile vektor) | Style URL di MapLibre GL | Gratis, tanpa API key dan tanpa registrasi, atribusi wajib (otomatis di MapLibre), tidak ada jaminan SLA |
| [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) | F6 tombol rute | `https://www.google.com/maps/dir/?api=1&destination=LAT%2CLON` | Tidak perlu API key, parameter `api=1` wajib |
| Kode wilayah Kemendagri | Memetakan destinasi ke kode adm4 BMKG | Dataset [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) atau lampiran Kepmendagri | Halaman BMKG masih merujuk Kepmendagri 100.1.1-6117 Tahun 2022, padahal sudah [diganti Kepmendagri 300.2.2-2138 Tahun 2025](https://www.komunitasbelajar.id/2025/05/pemberian-dan-pemutakhiran-kode-data.html). Setiap kode harus divalidasi dengan memanggil API BMKG |
| [Visiting Jogja, Dinas Pariwisata DIY](https://visitingjogja.jogjaprov.go.id/) | Referensi kurasi nama dan kategori destinasi | Dibaca manual | Tidak ada API dan tidak ada lisensi terbuka yang tercantum, jadi deskripsi ditulis sendiri dan foto tidak disalin |
| [SDG Goal 8](https://sdgs.un.org/goals/goal8) | Landasan subtema di proposal | - | Target 8.9 berisi kebijakan pariwisata berkelanjutan yang menciptakan lapangan kerja dan mempromosikan budaya serta produk lokal |

**Mengapa tile OpenStreetMap resmi tidak dipakai.** [Kebijakan tile OSM](https://operations.osmfoundation.org/policies/tiles/) mewajibkan User-Agent dan Referer yang valid, melarang prefetch, dan tidak memberi jaminan layanan. OpenFreeMap lebih aman untuk demo yang akan dibuka juri berkali-kali.

**Contoh query Overpass untuk fasilitas satu destinasi.**

```
[out:json][timeout:60];
(
  nwr(around:1500,LAT,LON)[amenity~"^(toilets|parking|restaurant|cafe|fast_food|atm|place_of_worship)$"];
  nwr(around:1500,LAT,LON)[highway=bus_stop];
  nwr(around:5000,LAT,LON)[railway=station];
);
out center tags;
```

Dengan 20 destinasi, impor penuh hanya 20 permintaan, jauh di bawah panduan Overpass.

## Stack teknologi

Pilihan ini meminimalkan jumlah server yang harus dirawat. Satu repository Next.js menampung halaman dan API, sedangkan database, autentikasi, dan PostGIS sudah tersedia di Supabase.

| Lapisan | Pilihan | Alasan | Batasan paket gratis yang relevan |
| --- | --- | --- | --- |
| Frontend + API | Next.js App Router, TypeScript, Tailwind CSS | Halaman dan route handler `/api/v1/*` dalam satu codebase, deploy otomatis dari GitHub | - |
| Database | Supabase PostgreSQL + [PostGIS](https://supabase.com/docs/guides/database/extensions/postgis) | Query jarak dan radius dengan indeks GIST, fungsi SQL dipanggil lewat `rpc()` | [Paket Free](https://supabase.com/pricing) 500 MB database, proyek dijeda setelah 1 minggu tidak aktif |
| Autentikasi | Supabase Auth + Row Level Security | Login email atau Google, aturan akses data ditegakkan di database | 50.000 MAU |
| Validasi | Zod | Satu skema dipakai untuk validasi input dan dokumentasi OpenAPI | - |
| Dokumentasi API | OpenAPI 3.1 (`@asteasolutions/zod-to-openapi`) + Swagger UI atau Scalar | Bukti konkret interoperabilitas untuk juri | - |
| Peta | MapLibre GL JS + OpenFreeMap | Gratis tanpa API key, atribusi otomatis | Tanpa SLA |
| Hosting | Vercel Hobby | Integrasi Next.js paling mulus, preview per branch | [Cron Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing) hanya sekali sehari, waktunya bisa meleset sampai 59 menit |
| Pengujian | Vitest (unit), Playwright (opsional, e2e) | Fungsi skor diuji otomatis | - |

**Konsekuensi dua batasan di atas.** Cron sekali sehari tidak cukup untuk mengikuti BMKG yang memperbarui data dua kali sehari. Karena itu pembaruan cuaca memakai pola *refresh saat dibaca* (lihat Arsitektur), dan cron harian hanya menjadi pemanas cache sekaligus menjaga proyek Supabase tetap aktif agar tidak dijeda.

**Alternatif jika tim lebih nyaman di PHP atau Python.** Laravel atau Django tetap bisa, tetapi butuh hosting server yang selalu menyala. Hosting gratis untuk keduanya umumnya "tidur" saat sepi sehingga akses pertama juri lambat. Pilihan ini perlu diputuskan hari ini juga.

## Arsitektur sistem

Browser hanya berbicara dengan API milik sendiri dan server tile peta. BMKG dan Overpass hanya dipanggil oleh server, lalu hasilnya disimpan di PostgreSQL sebelum disajikan.

&#91;embedded content: Arsitektur JelajahLokal · 3 lapisan, 3 sumber eksternal\]

Kotak yang disorot, Layanan cuaca, adalah inti pembeda produk. Alur satu permintaan prakiraan berjalan seperti ini.

1. Halaman detail memanggil `GET /api/v1/destinations/{slug}/forecast`.
2. API memvalidasi parameter, lalu meminta data ke Layanan cuaca.
3. Layanan cuaca mengecek `forecast_fetches`. Jika data wilayah itu lebih tua dari 6 jam dan belum ada proses lain yang mengambil, BMKG dipanggil dan hasilnya disimpan ke `forecasts`.
4. Skor dihitung dari baris `forecasts` dan bobot `score_profiles`, lalu dikirim bersama waktu produksi data dan status `isStale`.

Struktur folder yang disarankan adalah `app/` untuk halaman dan route handler, `lib/bmkg/` untuk adapter dan parser, `lib/scoring/` untuk fungsi skor murni yang mudah diuji, `lib/db/` untuk akses Supabase, `scripts/` untuk impor Overpass, dan `supabase/migrations/` untuk skema.

## Model data

Sembilan tabel inti cukup untuk semua fitur P0 dan P1. Bobot skor disimpan di tabel, bukan di kode, sehingga bisa disetel setelah uji pengguna tanpa deploy ulang.

| Tabel | Isi | Kunci dan indeks |
| --- | --- | --- |
| `regions` | Kode adm4 yang dipakai, nama desa, kecamatan, kabupaten | PK `adm4_code` |
| `destinations` | Destinasi hasil kurasi, kategori, indoor atau tidak, jam buka, deskripsi tulisan sendiri | PK `id`, unik `slug`, GIST pada `location` |
| `facilities` | Fasilitas dari OSM, tipe, nama, tag mentah | Unik `(osm_type, osm_id)`, GIST pada `location` |
| `forecasts` | Satu baris per slot 3 jam per wilayah | PK `(adm4_code, valid_at)` |
| `forecast_fetches` | Status pengambilan terakhir per wilayah, untuk deteksi data lama | PK `adm4_code` |
| `weather_alerts` | Peringatan dini aktif beserta poligonnya (P1) | PK `cap_id`, GIST pada `area` |
| `score_profiles` | Bobot skor per kategori | PK `category` |
| `trips`, `trip_items` | Rencana kunjungan milik pengguna | FK ke `auth.users`, RLS aktif |

```sql
create extension if not exists postgis schema extensions;

create type dest_category as enum ('pantai','alam','budaya','museum','desa_wisata');
create type facility_type as enum ('toilet','parkir','makan','ibadah','atm','halte','stasiun');

create table regions (
  adm4_code text primary key,            -- contoh '34.02.xx.xxxx', divalidasi lewat API BMKG
  desa text not null, kecamatan text not null, kabupaten text not null
);

create table destinations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category dest_category not null,
  is_indoor boolean not null default false,
  adm4_code text not null references regions,
  location extensions.geography(point, 4326) not null,
  open_hours jsonb,                        -- {"mon":["08:00","16:00"], ...}
  description text,
  osm_ref text,                            -- 'way/123456'
  verified_at date
);
create index on destinations using gist (location);

create table facilities (
  id bigserial primary key,
  osm_type text not null, osm_id bigint not null,
  type facility_type not null,
  name text,
  location extensions.geography(point, 4326) not null,
  tags jsonb,
  fetched_at timestamptz not null default now(),
  unique (osm_type, osm_id)
);
create index on facilities using gist (location);

create table forecasts (
  adm4_code text references regions,
  valid_at timestamptz,                    -- dari utc_datetime BMKG
  local_time timestamp not null,           -- dari local_datetime BMKG
  t numeric, hu numeric, ws numeric, wd text, tcc numeric,
  vs_text text, weather_desc text,
  analysis_date timestamptz not null,
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
  w_rain numeric not null, w_wind numeric not null,
  w_heat numeric not null, w_vis numeric not null
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  created_at timestamptz default now()
);
create table trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips on delete cascade,
  destination_id uuid not null references destinations,
  planned_slot timestamptz,
  position int not null default 0
);

alter table trips enable row level security;
create policy own_trips on trips for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table trip_items enable row level security;
create policy own_items on trip_items for all
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()));
```

Fungsi SQL yang dipanggil lewat `rpc()` cukup tiga, yaitu `facilities_near(dest_id, radius_m, types[])`, `indoor_alternatives(dest_id, slot, radius_m)`, dan `destinations_in_bbox(...)`. Semuanya memakai `ST_DWithin` dan operator `<->` sesuai pola di dokumentasi Supabase.

## Logika skor kelayakan kunjungan

Skor 0 sampai 100 dihitung per destinasi per slot 3 jam, dengan mengurangi 100 dengan empat penalti cuaca yang dibobot sesuai kategori destinasi. Semua ambang di bawah adalah **asumsi desain tim**, bukan standar BMKG, dan harus ditulis begitu di proposal.

```latex
S = \max\left(0,\; 100 - \left(w_{rain} P_{rain} + w_{wind} P_{wind} + w_{heat} P_{heat} + w_{vis} P_{vis}\right)\right)
```

**Penalti (masing-masing 0 sampai 100).**

| Penalti | Masukan BMKG | Aturan |
| --- | --- | --- |
| P\_rain | `weather_desc` | Cerah, Cerah Berawan, Berawan = 0 · Berawan Tebal = 10 · Hujan Ringan = 40 · Hujan Sedang = 70 · Hujan Lebat = 90 · Hujan Petir = 100 |
| P\_wind | `ws` (km/jam) | 0 jika ≤ 15, naik linear sampai 100 pada 45 km/jam |
| P\_heat | `t` (°C) | 0 jika ≤ 30, naik linear sampai 100 pada 36 °C |
| P\_vis | `weather_desc`, `vs_text` | Kabut, Asap, Udara Kabur = 60, selain itu 0 |

Daftar teks `weather_desc` di atas perlu dicocokkan dengan nilai yang benar-benar muncul di respons API pada hari pertama pengembangan. Teks yang tidak dikenal diberi penalti 0 dan dicatat ke log.

**Bobot awal per kategori (tabel `score_profiles`).**

| Kategori | w\_rain | w\_wind | w\_heat | w\_vis | Alasan singkat |
| --- | --- | --- | --- | --- | --- |
| Pantai | 1.0 | 0.8 | 0.5 | 0.3 | Terbuka penuh, angin kencang berbahaya di pantai selatan |
| Alam | 1.0 | 0.5 | 0.3 | 0.8 | Jalur licin saat hujan, pemandangan bergantung jarak pandang |
| Budaya | 0.8 | 0.1 | 0.8 | 0.1 | Banyak area terbuka, panas siang sangat terasa |
| Desa wisata | 0.7 | 0.2 | 0.5 | 0.1 | Campuran kegiatan luar dan dalam ruangan |
| Museum | 0.1 | 0 | 0.1 | 0 | Hampir seluruhnya di dalam ruangan |

**Aturan tambahan.**

1. Slot di luar jam buka diberi status "Tutup" dan tidak dinilai.
2. Jika ada peringatan dini aktif di kecamatan destinasi (P1), skor dibatasi maksimal 20 dengan alasan "Peringatan dini BMKG aktif".
3. Label ditentukan dari skor, yaitu 75 ke atas "Sangat sesuai", 50 sampai 74 "Cukup sesuai", di bawah 50 "Kurang sesuai".
4. Alasan yang ditampilkan adalah penalti berbobot yang nilainya lebih dari 10, diurutkan dari yang terbesar, misalnya "Hujan ringan diprakirakan (−40)".

**Contoh hitungan untuk destinasi pantai.**

| Slot | Prakiraan | Penalti berbobot | Skor | Label |
| --- | --- | --- | --- | --- |
| 09.00 | Berawan, angin 12 km/jam, 28 °C | 0 | 100 | Sangat sesuai |
| 15.00 | Hujan Ringan, angin 25 km/jam, 31 °C | 40 + 26,7 + 8,3 = 75 | 25 | Kurang sesuai |

**Alternatif saat cuaca buruk (F5).** Dipicu jika skor di bawah 50 dan penalti terbesarnya hujan. Sistem mencari destinasi dengan `is_indoor = true` dalam radius 15 km yang buka pada slot itu dan skornya minimal 60, diurutkan dari yang terdekat, maksimal 3. Jika tidak ada, tampilkan slot lain di destinasi yang sama yang skornya paling tinggi.

**Kalibrasi.** Pada uji pengguna, responden diminta menilai apakah label untuk beberapa skenario sesuai dengan penilaian mereka sendiri. Hasilnya dipakai untuk menyetel bobot, dan proses ini ditulis di proposal sebagai bukti metodologi.

## Desain REST API v1

Semua endpoint berada di bawah `/api/v1`, mengembalikan JSON, dan didokumentasikan otomatis di `/api/docs`. Endpoint publik hanya-baca, sedangkan endpoint rencana kunjungan wajib login.

| Metode dan path | Fungsi | Auth | Parameter utama |
| --- | --- | --- | --- |
| `GET /destinations` | Daftar destinasi | - | `category`, `q`, `bbox` |
| `GET /destinations/{slug}` | Detail destinasi | - | - |
| `GET /destinations/{slug}/forecast` | Prakiraan + skor per slot | - | `days` (1 sampai 3) |
| `GET /destinations/{slug}/facilities` | Fasilitas sekitar dengan jarak | - | `radius` (100 sampai 3000 m), `type` |
| `GET /destinations/{slug}/alternatives` | Destinasi indoor alternatif | - | `slot` (ISO 8601) |
| `GET /recommendations` (P1) | Destinasi dengan skor tertinggi pada slot tertentu | - | `slot`, `category` |
| `GET /alerts` (P1) | Peringatan dini aktif yang mengenai destinasi | - | `destination` |
| `GET /trips`, `POST /trips` | Daftar dan buat rencana | Wajib | `title` |
| `PATCH /trips/{id}`, `DELETE /trips/{id}` | Ubah dan hapus rencana | Wajib | - |
| `POST /trips/{id}/items`, `DELETE /trips/{id}/items/{itemId}` | Tambah dan hapus destinasi di rencana | Wajib | `destinationId`, `plannedSlot` |
| `GET /health` | Status database dan kesegaran data BMKG | - | - |
| `GET /api/cron/refresh` | Pemanas cache harian | Header rahasia | - |

**Contoh respons `GET /destinations/pantai-parangtritis/forecast`.**

```json
{
  "destination": { "slug": "pantai-parangtritis", "category": "pantai" },
  "source": {
    "provider": "BMKG",
    "analysisDate": "2026-10-15T00:00:00Z",
    "fetchedAt": "2026-10-15T06:12:04Z",
    "isStale": false
  },
  "slots": [
    {
      "localTime": "2026-10-16T15:00:00+07:00",
      "weatherDesc": "Hujan Ringan", "t": 31, "ws": 25, "hu": 78,
      "score": 25, "label": "Kurang sesuai",
      "reasons": ["Hujan ringan diprakirakan (-40)", "Angin 25 km/jam (-27)"],
      "hasAlternatives": true
    }
  ]
}
```

Nilai di contoh ini ilustrasi, bukan data nyata.

**Konvensi.** Error memakai format yang sama, yaitu `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` dengan status 400, 401, 404, 429, atau 503. Endpoint publik mengirim header `Cache-Control: s-maxage=600, stale-while-revalidate=3600` agar CDN Vercel ikut menahan beban.

## Halaman dan alur pengguna

Lima halaman cukup untuk seluruh fitur P0. Desain mobile-first karena wisatawan kemungkinan besar membuka dari ponsel.

| Halaman | Isi utama | Fitur |
| --- | --- | --- |
| `/` Beranda | Peta + daftar destinasi, filter kategori, pilihan hari (Hari ini, Besok, Lusa), warna penanda sesuai skor slot terbaik hari itu | F1, F3, F11 |
| `/destinasi/[slug]` | Ringkasan skor, strip 3 jam, alasan, prakiraan rinci, fasilitas di peta kecil + daftar berjarak, halte/stasiun, tombol rute, kartu alternatif, atribusi | F2 sampai F6, F8, F10 |
| `/rencana` | Daftar rencana kunjungan, tiap destinasi dengan slot pilihan dan skornya saat ini | F7 |
| `/tentang-data` | Sumber data, lisensi, rumus skor, bobot per kategori, disclaimer | F8 |
| `/api/docs` | Dokumentasi API interaktif | F9 |

**Alur utama (skenario untuk proposal dan video).**

1. Pengguna membuka Beranda dan memilih kategori Pantai untuk besok.
2. Peta menandai pantai dengan warna sesuai skor terbaiknya besok.
3. Pengguna membuka Pantai Parangtritis dan melihat pagi "Sangat sesuai" sedangkan sore "Kurang sesuai" karena hujan.
4. Pengguna melihat toilet, parkir, dan tempat makan terdekat beserta jaraknya, lalu menekan "Buka rute".
5. Untuk sore hari, kartu alternatif menyarankan museum terdekat yang skornya baik.
6. Pengguna login dan menyimpan rencana "Pagi Parangtritis, sore museum".

**Arahan UI/UX untuk kriteria desain (15%).** Gunakan satu palet dengan tiga warna status yang tetap bisa dibedakan oleh penderita buta warna (tambahkan ikon dan teks label, jangan mengandalkan warna saja). Pastikan kontras teks memenuhi WCAG AA, semua tombol bisa diakses keyboard, dan peta selalu punya padanan berupa daftar.

## Keamanan dan ketahanan

Bagian ini menjawab kriteria "penanganan kerentanan web dasar" dan narasi high availability di tema lomba. Setiap butir harus benar-benar ada di kode, karena juri bisa membuka repository.

**Keamanan.**

- **Validasi input.** Semua parameter query dan body divalidasi dengan Zod, misalnya `slug` hanya `^[a-z0-9-]{1,80}$`, `radius` 100 sampai 3000, `title` 1 sampai 80 karakter. Input tidak valid ditolak dengan status 400.
- **Autentikasi dan otorisasi.** Supabase Auth untuk login. Row Level Security memastikan pengguna hanya bisa membaca dan mengubah rencana miliknya, bahkan jika ada bug di API.
- **Pengelolaan rahasia.** `SUPABASE_SERVICE_ROLE_KEY` dan `CRON_SECRET` hanya ada di environment server Vercel. Repository hanya berisi `.env.example`.
- **Pembatasan laju.** Endpoint tulis dibatasi, misalnya 30 permintaan per menit per pengguna, dengan penghitung di tabel Postgres karena memori fungsi serverless tidak bertahan antar-permintaan.
- **XSS.** Nama fasilitas dari OSM adalah data pihak luar, jadi selalu dirender sebagai teks oleh React dan tidak pernah lewat `dangerouslySetInnerHTML`.
- **Header keamanan.** Content-Security-Policy yang hanya mengizinkan domain OpenFreeMap dan Supabase, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `Permissions-Policy` untuk geolokasi.
- **Dependensi.** Dependabot aktif di GitHub dan `npm audit` dijalankan sebelum pengumpulan.

**Ketahanan (high availability).**

- **Refresh saat dibaca.** Saat prakiraan suatu wilayah lebih tua dari 6 jam, permintaan berikutnya memicu pengambilan ulang dari BMKG. Hanya satu permintaan yang boleh mengambil, dikunci dengan `UPDATE forecast_fetches SET last_attempt_at = now() WHERE adm4_code = $1 AND last_attempt_at < now() - interval '2 minutes' RETURNING *`. Permintaan lain langsung dilayani dari cache.
- **Tetap melayani saat BMKG gagal.** Timeout 8 detik dan satu kali coba ulang. Jika tetap gagal, data terakhir tetap dikirim dengan `isStale: true` dan label di UI. Data dianggap lama jika keberhasilan terakhir lebih dari 13 jam lalu.
- **Menghormati batas BMKG.** Cron harian memanggil wilayah satu per satu dengan jeda sekitar 1,1 detik, sehingga tidak pernah mendekati 60 permintaan per menit.
- **Cache berlapis.** Database sebagai cache utama, lalu header CDN Vercel untuk respons publik.
- **Pemantauan.** `GET /api/v1/health` melaporkan koneksi database, jumlah wilayah dengan data lama, dan waktu sukses BMKG terakhir. Endpoint ini bisa ditunjukkan langsung saat presentasi final.
- **Proyek tidak dijeda.** Cron harian menyentuh database sehingga proyek Supabase Free tidak dianggap tidak aktif selama periode lomba.

## Rencana pengujian

Proposal wajib memuat "Hasil Pengujian Pengguna", dan slide final nanti diminta menyebut metode, jumlah responden, serta metrik kunci. Jadi pengujian pengguna dijadwalkan 25 sampai 26 Oktober, bukan di akhir.

| Jenis | Yang diuji | Alat | Bukti untuk proposal |
| --- | --- | --- | --- |
| Unit | Fungsi skor (termasuk contoh hitungan di atas), parser respons BMKG dengan fixture JSON asli, skema Zod | Vitest | Jumlah tes lulus, cuplikan kasus uji |
| Integrasi API | 400 untuk input tidak valid, 401 untuk rencana tanpa login, pengguna B tidak bisa membaca rencana pengguna A | Vitest + Supabase lokal atau proyek uji | Tabel kasus uji dan hasilnya |
| Ketahanan | URL BMKG dibuat gagal, API tetap merespons dengan `isStale: true` | Variabel environment uji | Tangkapan layar respons dan label UI |
| Performa dan aksesibilitas | Halaman Beranda dan Detail | Lighthouse | Skor Performance dan Accessibility |
| Beban ringan (P1) | Endpoint forecast dengan 50 koneksi bersamaan, sebelum dan sesudah cache | autocannon | Latensi p95 dan jumlah error |
| Pengguna | 5 tugas dari alur utama | Tatap muka atau Google Meet, kuesioner Google Forms | Tingkat keberhasilan tugas, waktu per tugas, skor SUS, temuan dan perbaikannya |

**Uji pengguna.** Targetkan 10 sampai 15 responden dari target pengguna (wisatawan domestik, mahasiswa yang sering berwisata di DIY). Setiap responden mengerjakan 5 tugas, lalu mengisi kuesioner System Usability Scale (10 butir) dan 3 pertanyaan kalibrasi skor ("Apakah label untuk skenario ini sesuai penilaian Anda?"). Catat minimal 3 temuan dan perbaikan yang dilakukan, karena juri menilai proses, bukan hanya angka.

## Pembagian kerja dan jadwal

Orang A memegang data dan backend, Orang B memegang antarmuka dan produk, dan proposal ditulis bersama. Metodologinya iterasi singkat bergaya Agile dengan tiga sprint (Fondasi, Fitur inti, Fitur lengkap), dan itu yang ditulis di bab Metodologi proposal.

&#91;embedded content: Jadwal 15 Oktober sampai 30 Oktober · 5 tahap, 2 orang\]

Gerbang terpenting adalah 24 Oktober. Jika pada tanggal itu ada fitur P0 yang belum jalan, potong scope-nya, jangan geser jadwal uji pengguna.

**Daftar periksa pengumpulan 30 Oktober.**

- [ ] Website online dan bisa dibuka tanpa login untuk fitur publik
- [ ] Repository GitHub publik, bisa diakses tanpa izin tambahan sampai lomba selesai
- [ ] README berisi cara menjalankan, struktur folder, dan tautan demo
- [ ] Proposal PDF maksimal 30 halaman, nama file `UINIC8#2026_WEBDEV_[Nama_Tim]_[Nama Instansi].pdf`
- [ ] Logo UINIC 8.0 di proposal
- [ ] Surat Pernyataan Orisinalitas bermaterai, ditandatangani ketua tim
- [ ] Tautan demo dan repository diisi di formulir pengumpulan

## Pemetaan ke kriteria juri

Babak penyisihan menilai proposal dan repository dengan lima kriteria. Tabel ini menunjukkan bukti apa yang harus terlihat jelas untuk tiap kriteria.

| Kriteria penyisihan | Bobot | Bukti yang ditonjolkan |
| --- | --- | --- |
| Inovasi dan relevansi solusi | 30% | Skor per kategori + alternatif saat cuaca buruk, tabel perbandingan dengan Google Maps dan aplikasi cuaca biasa |
| Kesesuaian dengan kebutuhan pengguna | 20% | Persona wisatawan, alur 6 langkah, hasil uji pengguna dan perbaikannya |
| Kualitas teknis dan fungsionalitas | 20% | Zod, RLS, rate limit, header keamanan, struktur folder modular, tes otomatis, `/health` |
| Kualitas desain UI/UX | 15% | Konsistensi komponen, label status tidak bergantung warna, skor Lighthouse Accessibility |
| Dokumentasi dan kelengkapan proposal | 15% | Semua 15 butir format proposal, README, panduan penggunaan, OpenAPI, rencana P2 |

**Peta isi proposal (maks. 30 halaman tanpa lampiran).**

| Butir wajib proposal | Diambil dari bagian dokumen ini |
| --- | --- |
| Nama anggota, judul, latar belakang, tujuan dan manfaat | Ringkasan |
| Analisis (target pengguna, batasan produk, platform) | Ringkasan, Fitur MVP, Stack teknologi |
| Metodologi pengembangan | Jadwal (iterasi singkat bergaya Agile, 3 sprint) |
| Arsitektur sistem | Arsitektur sistem, Model data, Desain API |
| Skenario dan user flow | Halaman dan alur pengguna |
| Fitur unggulan | Fitur MVP, Logika skor |
| UI/UX preview | Tangkapan layar aplikasi yang sudah jadi |
| Hasil pengujian pengguna | Rencana pengujian, diisi data nyata |
| Kesimpulan, daftar pustaka | Sumber data |

Karena proposal bersifat final setelah dikirim, setiap fitur yang disebut di proposal harus sudah berjalan di demo. Fitur P1 yang belum selesai ditulis sebagai pengembangan berikutnya, bukan sebagai fitur.

## Risiko dan mitigasi

Risiko terbesar adalah waktu, bukan teknologi. Mitigasi utamanya adalah feature freeze pada 24 Oktober.

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Fitur belum selesai saat uji pengguna | Bagian pengujian di proposal kosong atau lemah | Feature freeze 24 Oktober, P1 hanya jika P0 selesai |
| Kode adm4 destinasi tidak dikenali BMKG | Destinasi tanpa prakiraan | Validasi semua 20 kode di hari kedua dengan memanggil API, ganti destinasi jika gagal |
| Struktur respons atau teks `weather_desc` BMKG berbeda dari asumsi | Parser atau skor salah | Simpan satu respons asli sebagai fixture tes di hari pertama |
| BMKG tidak bisa diakses saat juri membuka demo | Halaman kosong | Data terakhir tetap dilayani dengan label data lama |
| Data fasilitas OSM di sekitar destinasi minim | Daftar fasilitas kosong saat demo | Pilih destinasi yang datanya cukup, tambahkan fasilitas kurasi manual dengan sumber yang jelas |
| Proyek Supabase Free dijeda | Demo mati | Cron harian menyentuh database, cek dashboard tiap hari sampai 27 November |
| Juri menganggap skor tidak ilmiah | Nilai inovasi dan tanya jawab turun | Tulis ambang sebagai asumsi desain, tunjukkan kalibrasi dari uji pengguna, siapkan jawaban untuk sesi tanya jawab |
| Satu anggota berhalangan | Jadwal mundur | Kedua orang paham alur data end-to-end, kerja lewat pull request kecil |

## Yang masih perlu diverifikasi

Butir-butir ini belum bisa dipastikan dari halaman resmi atau bergantung pada data nyata. Centang setelah dicek.

- [ ] Struktur JSON respons BMKG dan daftar nilai `weather_desc` yang benar-benar muncul (ambil satu respons asli untuk wilayah DIY).
- [ ] Validitas 20 kode adm4 destinasi di API BMKG, mengingat BMKG masih merujuk Kepmendagri 2022 sedangkan acuan terbaru Kepmendagri 2025.
- [ ] Cara Vercel mengirim `CRON_SECRET` ke endpoint cron, cek di dokumentasi Vercel Cron Jobs.
- [ ] Lisensi dataset kode wilayah yang dipakai (misalnya cahyadsn/wilayah) sebelum disertakan di repository.
- [ ] Kelengkapan fasilitas OSM di sekitar tiap destinasi lewat Overpass Turbo.
- [ ] Jam buka tiap destinasi dari sumber pengelola resmi.
- [ ] Apakah nama "JelajahLokal" sudah dipakai produk lain.
- [ ] Rujukan resmi System Usability Scale dan angka acuan interpretasinya sebelum dikutip di proposal.
- [ ] Syarat layanan OpenFreeMap terbaru.
- [ ] Pendaftaran Gelombang II (Rp65.000), konfirmasi ke narahubung maksimal 1 × 24 jam, logo UINIC 8.0, template proposal resmi, dan materai 10.000 untuk Surat Pernyataan Orisinalitas.
