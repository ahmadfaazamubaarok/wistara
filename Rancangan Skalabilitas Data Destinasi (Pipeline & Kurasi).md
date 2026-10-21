# Rancangan Skalabilitas Data Pengayaan Destinasi (Pipeline & Kurasi)

Dokumen ini mendokumentasikan asal-usul data destinasi di Wistara (365 destinasi DIY; data pengayaan *tiket, sorotan, parkir, tips, tag* terkurasi baru untuk 36 di antaranya), serta strategi arsitektur untuk menskalakan data ini menuju ribuan destinasi di seluruh Indonesia pada fase produksi nyata.

Dokumen ini dapat digunakan sebagai bahan rujukan proposal, dokumentasi teknis, dan panduan menjawab pertanyaan dewan juri/evaluator.

> **Status dokumen (diperbarui 22 Okt 2026).** Versi awal ditulis 17 Okt untuk 20 destinasi percontohan. Sejak itu katalog diperluas ke seluruh DIY (365 destinasi) dan **jalur usulan pengelola sudah dibangun** (bagian 2, pilar 4). Tiap pilar di bagian 2 kini diberi status: **sudah**, **sebagian**, atau **rancangan**.

---

## 1. Status Data Saat Ini (365 Destinasi DIY)

| Jenis data | Cakupan saat ini | Sumber |
|---|---|---|
| Nama, kategori, koordinat | 365 destinasi di 5 kabupaten/kota (disaring ke batas wilayah DIY) | OpenStreetMap lewat Overpass (`scripts/import-all-diy-destinations.ts`), batas DIY di `supabase/seed/diy-boundary.json` |
| Fasilitas sekitar (toilet, parkir, makan, ibadah, ATM, halte, stasiun) | 1.337 titik | OpenStreetMap lewat Overpass |
| Prakiraan cuaca 3 hari per 3 jam | 30 wilayah cuaca BMKG | API BMKG, "refresh saat dibaca" |
| Prakiraan maritim (gelombang, arus, angin laut) | 50 pantai di 3 wilayah perairan | API maritim BMKG |
| Jam buka tetap | 20 destinasi (sisanya memakai jendela kunjungan bawaan 06.00–18.00) | Kurasi tim |
| Jam buka **terverifikasi ke pengelola** (`verified_at`) | 12 destinasi | Kurasi tim, dan, ke depan, jalur usulan pengelola |
| Informasi praktis (tiket, sorotan, parkir, tips, tag) | **36 destinasi**; destinasi lain jujur menampilkan "belum terdata" | Kurasi tim, tersimpan di [`src/lib/destination-enrichment.ts`](src/lib/destination-enrichment.ts) dan ditampilkan pada [`destination-enrichment-card.tsx`](src/components/destination/destination-enrichment-card.tsx) |

### A. Asal-Usul Data Pengayaan (36 destinasi terkurasi)
Data pengayaan dihimpun tim dari publikasi dan regulasi resmi. Contohnya:
1. **Museum Sonobudoyo**: Tarif Rp 10.000 (Gedung Utama) dan Rp 20.000 (Gedung Pameran Seni Imersif Visual 360°) bersumber dari tarif resmi Dinas Kebudayaan DIY. Informasi pertunjukan wayang kulit harian di pendopo adalah program resmi.
2. **Candi Prambanan & Ratu Boko**: Tarif Rp 50.000 (Dewasa) dan Rp 25.000 (Anak) bersumber dari tarif resmi PT Taman Wisata Candi (TWC).
3. **Pesisir Pantai (Parangtritis, Baron, Indrayanti)**: Tarif retribusi TPR Rp 10.000 bersumber dari Peraturan Daerah (Perda) Retribusi Wisata Pemkab Bantul & Gunungkidul.
4. **Tips Kunjungan & Keselamatan**: Bersumber dari aturan di lapangan (contoh: keberadaan palung laut berbahaya *rip current* di Parangtritis, larangan lampu kilat di Museum Affandi, atau anjuran pakaian ganti di Desa Wisata Pentingsari).

Data ini **belum diverifikasi langsung ke pengelola** dan perlu ditinjau berkala; tarif dan jam khusus (misalnya libur lebaran) bisa berubah. Karena itu jalur usulan dan pembaruan oleh pengelola (pilar 4) adalah bagian penting rancangan ini.

### B. Perbedaan Sumber Data Wistara
| Jenis Data | Sumber Asal | Sifat Pembaruan |
|---|---|---|
| **Prakiraan Cuaca 3-Jaman** | API Resmi BMKG | Dinamis (tiap slot 3 jam), disegarkan saat dibaca bila lebih tua dari 6 jam |
| **Prakiraan Maritim** | API Maritim BMKG | Dinamis; lebih tua dari 24 jam dianggap "belum tersedia" |
| **Katalog, Koordinat & Fasilitas Sekitar** | OpenStreetMap (OSM) via Overpass API | Impor geospasial sekali jalan, bisa diulang |
| **Informasi Praktis (Tiket, Tips, Daya Tarik)** | Kurasi tim pengembang | Statis terkurasi (`destination-enrichment.ts`) |
| **Destinasi Baru** | Usulan pengelola lewat `/usul`, ditinjau admin | Berbasis peninjauan manusia |

---

## 2. Strategi Skalabilitas Menuju Produksi Nyata (Fase Skala Nasional)

Ketika Wistara diekspansi ke berbagai provinsi dan ribuan destinasi baru di Indonesia, penginputan manual tidak lagi efisien. Arsitektur data Wistara dirancang menggunakan **4 pilar pipa data**:

| Pilar | Status |
|---|---|
| 1. Pipa Ekstraksi AI Terotomatisasi | **Rancangan.** Belum dibangun. |
| 2. Otomasi Geospasial dari OpenStreetMap | **Sudah.** Dijalankan untuk seluruh DIY (365 destinasi). |
| 3. Integrasi Data Terbuka Pemerintah | **Rancangan.** Belum dibangun. |
| 4. Portal Mandiri Pengelola Destinasi | **Sebagian.** Pengelola bisa mengusulkan destinasi baru; klaim dan pembaruan data destinasi yang sudah ada belum ada. |

### 1. Pipa Ekstraksi AI Terotomatisasi (*AI-Assisted Ingestion Pipeline*) — rancangan
Di Indonesia, banyak destinasi wisata daerah tidak memiliki website resmi khusus, namun memiliki akun media sosial resmi (Instagram), profil Google Maps Bisnis, atau artikel publikasi Pemda.

**Alur Kerja Skrip Ekstraksi:**
```
Target Destinasi Baru (Nama & Koordinat OSM)
       │
       ▼
1. Web & Social Discovery (Google Search API / Firecrawl)
   -> Menelusuri publikasi resmi pengelola, akun media sosial, & berita Pemda
       │
       ▼
2. Ekstraksi AI Berbasis Skema (Gemini 2.0 Flash / LLM Extractor)
   -> Mengekstrak teks mentah menjadi skema TypeScript terstruktur:
      - ticketPrice (domestic, international, parking)
      - highlights (3 poin keunggulan utama)
      - tips (panduan berkunjung, pakaian, etika)
      - tags (kategori minat)
       │
       ▼
3. Validasi & Penyimpanan Database
   -> Masuk ke database dengan metadata status: "draft_unverified"
```

### 2. Otomasi Geospasial dari OpenStreetMap (OSM) — sudah
Skrip yang telah berjalan di Wistara: `import-all-diy-destinations.ts` (katalog seluruh DIY, disaring ke batas wilayah DIY), `import-diy-toilets.ts`, `seed-destinations.ts`, dan `seed-facilities.ts`.
- Penambahan kabupaten baru cukup memicu *query* Overpass OSM.
- Data POI wisata (`tourism=*`), titik koordinat presisi, serta fasilitas umum (toilet, musala, parkir, halte) terimpor secara otomatis dalam hitungan detik.
- Kelemahan yang diketahui: data OSM untuk destinasi desa sering tipis dan ada kandidat duplikat (lihat "Data yang perlu tindak lanjut" di README). Karena itu hasil impor tidak dianggap terverifikasi.

### 3. Integrasi Data Terbuka Pemerintah (B2G Integration) — rancangan
Wistara dapat terhubung langsung dengan inisiatif data pariwisata pemerintah:
- **JADESTA Kemenparekraf** (*Jejaring Desa Wisata Indonesia*): Database resmi ribuan desa wisata di seluruh Indonesia.
- **Satu Data Indonesia / Open Data Pemda**: Data buku tarif retribusi tempat rekreasi daerah yang tersedia dalam format data terbuka (CSV/API).

### 4. Portal Mandiri Pengelola Destinasi (*Wistara Partner Portal*) — sebagian
Mengadopsi model *Google Business Profile* atau *Traveloka Partner*: pengelola wisata lokal (Pokdarwis, BUMDes, atau Dinas Pariwisata setempat) diberi jalur gratis untuk memasukkan dan memperbarui data mereka sendiri.

**Yang sudah ada (versi awal):**
- Formulir usulan di `/usul` (perlu login): nama, kategori, lokasi di peta, alamat, jam buka, nama pengelola atau lembaga, hubungan dengan destinasi, kontak WhatsApp, dan tautan bukti.
- Lokasi **divalidasi di server** terhadap batas DIY; kabupaten dan alamat disarankan otomatis dari peta (tetap bisa diubah); titik yang sangat dekat dengan destinasi yang ada ditolak sebagai duplikat.
- Panel admin di `/admin/usulan`: admin melihat kandidat duplikat, menyetujui (membuat destinasi `origin = 'usulan'`) atau menolak dengan alasan yang terbaca pengusul. Tanggal verifikasi jam buka hanya terisi bila admin menegaskan sudah dikonfirmasi ke pengelola.
- Perlindungan: usulan tidak langsung tayang; nomor WhatsApp hanya terbaca pemilik usulan dan admin (RLS) dan dihapus bila ditolak; pembatas 5 usulan menunggu per akun dan 5 pengiriman per jam.

**Yang belum ada:** klaim destinasi yang sudah ada dan pembaruan datanya oleh pengelola (harga tiket musiman, jam khusus), dashboard per pengelola, unggah foto, notifikasi email, dan verifikasi identitas pengelola (saat ini admin menghubungi lewat WhatsApp).

---

## 3. Penjaminan Kualitas: Prinsip *Human-in-the-Loop*

Untuk menjaga kepercayaan wisatawan dan mencegah kesalahan informasi:
1. **Metadata Verifikasi**: `destinations.verified_at` menandai jam buka yang sudah dikonfirmasi ke pengelola (12 dari 365 saat ini; kosong berarti "belum diverifikasi" dan ditampilkan begitu). Untuk data keselamatan pantai, tabel `beach_safety` mewajibkan `source_url` dan `verified_at`, dan tanpa data terkurasi kotak "Sebelum bermain air" menyatakan terus terang bahwa infonya belum diverifikasi.
2. **Peninjauan Manusia Sebelum Tayang**: setiap usulan pengelola ditinjau admin (di `/admin/usulan`) sebelum menjadi destinasi. Peninjauan satu klik untuk draf hasil ekstraksi AI (pilar 1) tetap rancangan.
3. **Prinsip Kejujuran Data**: Jika informasi tiket atau fasilitas belum terverifikasi dengan pasti, sistem akan menampilkan *"Belum terdata"* daripada menampilkan estimasi spekulatif. Prinsip yang sama berlaku untuk kondisi laut: status ditulis sebagai prakiraan wilayah perairan, dan kata "aman" tidak dipakai.

---

## 4. Panduan Menjawab Pertanyaan Evaluator / Juri Lomba

> **Pertanyaan Juri:**  
> *"Data tiket masuk, parkir, dan tips praktis di aplikasi kalian ini didapat dari mana? Apakah dari OpenStreetMap? Dan bagaimana jika destinasinya bertambah ribuan di luar Jogja?"*

> **Jawaban Rekomendasi:**  
> *"Katalog 365 destinasi DIY dan fasilitas fisik seperti toilet dan parkir kami impor dari OpenStreetMap, lalu disaring ke batas wilayah DIY. Data tiket dan panduan praktis baru kami kurasi untuk 36 destinasi dari publikasi resmi pengelola dan regulasi retribusi daerah; untuk destinasi lain, aplikasi menampilkan 'belum terdata' dan tidak menebak.*  
>  
> *Untuk skalabilitas, ada tiga jalur. Pertama, impor geospasial OSM, yang sudah kami jalankan untuk seluruh DIY. Kedua, jalur usulan pengelola: pengelola mengusulkan destinasi lewat formulir dan admin meninjaunya sebelum tayang, yang sudah berjalan sebagai versi awal. Ketiga, pipa ekstraksi berbantuan AI dengan peninjauan manusia sebelum dipublikasikan, yang masih berupa rancangan. Prinsipnya sama di ketiganya: data tidak tayang tanpa peninjauan, dan data yang belum terverifikasi ditandai apa adanya."*
