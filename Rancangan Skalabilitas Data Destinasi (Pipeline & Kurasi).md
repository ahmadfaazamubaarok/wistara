# Rancangan Skalabilitas Data Pengayaan Destinasi (Pipeline & Kurasi)

Dokumen ini mendokumentasikan asal-usul data pengayaan destinasi (*ticket price, highlights, parking, tips, tags*) yang ada di Wistara, serta strategi arsitektur untuk menskalakan (*scale-up*) data ini dari 20 destinasi percontohan (fase MVP) menuju ratusan atau ribuan destinasi di seluruh Indonesia pada fase produksi nyata.

Dokumen ini dapat digunakan sebagai bahan rujukan proposal, dokumentasi teknis, dan panduan menjawab pertanyaan dewan juri/evaluator.

---

## 1. Status Data Saat Ini (Fase MVP / 20 Destinasi Percontohan DIY)

Seluruh informasi praktis destinasi saat ini tersimpan terstruktur di [`src/lib/destination-enrichment.ts`](file:///c:/wistara/src/lib/destination-enrichment.ts) dan ditampilkan pada kartu detail destinasi ([`destination-enrichment-card.tsx`](file:///c:/wistara/src/components/destination/destination-enrichment-card.tsx)).

### A. Asal-Usul & Validitas Data
Data pada 20 destinasi percontohan adalah **100% faktual dan nyata**, dihimpun melalui kurasi tim pengembang dari publikasi dan regulasi resmi:
1. **Museum Sonobudoyo**: Tarif Rp 10.000 (Gedung Utama) dan Rp 20.000 (Gedung Pameran Seni Imersif Visual 360°) adalah tarif resmi dari Dinas Kebudayaan DIY. Informasi pertunjukan wayang kulit harian di pendopo adalah program resmi.
2. **Candi Prambanan & Ratu Boko**: Tarif Rp 50.000 (Dewasa) dan Rp 25.000 (Anak) adalah tarif resmi PT Taman Wisata Candi (TWC).
3. **Pesisir Pantai (Parangtritis, Baron, Indrayanti)**: Tarif retribusi TPR Rp 10.000 bersumber dari Peraturan Daerah (Perda) Retribusi Wisata Pemkab Bantul & Gunungkidul.
4. **Tips Kunjungan & Keselamatan**: Bersumber dari aturan nyata di lapangan (contoh: keberadaan palung laut berbahaya *rip current* di Parangtritis, larangan lampu kilat di Museum Affandi, atau anjuran pakaian ganti di Desa Wisata Pentingsari).

### B. Perbedaan Sumber Data Wistara
| Jenis Data | Sumber Asal | Sifat Pembaruan |
|---|---|---|
| **Prakiraan Cuaca 3-Jaman** | API Resmi BMKG | Dinamis real-time (tiap slot 3 jam) |
| **Koordinat & Fasilitas Sekitar (Toilet, Parkir, Halte)** | OpenStreetMap (OSM) via Overpass API | Terotomatisasi geospasial (radius 1,5 km) |
| **Informasi Praktis (Tiket, Tips, Daya Tarik)** | Kurasi Resmi Tim Pengembang | Statis terkurasi (`destination-enrichment.ts`) |

---

## 2. Strategi Skalabilitas Menuju Produksi Nyata (Fase Skala Nasional)

Ketika Wistara diekspansi ke berbagai provinsi dan ribuan destinasi baru di Indonesia, penginputan manual tidak lagi efisien. Arsitektur data Wistara dirancang menggunakan **4 pilar pipa data otomatis (*Data Ingestion Pipeline*)**:

### 1. Pipa Ekstraksi AI Terotomatisasi (*AI-Assisted Ingestion Pipeline*)
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

### 2. Otomasi Geospasial dari OpenStreetMap (OSM)
Seperti skrip yang telah berjalan di Wistara (`seed-destinations.ts` dan `seed-facilities.ts`):
- Penambahan kabupaten baru cukup memicu *query* Overpass OSM.
- Data POI wisata (`tourism=*`), titik koordinat presisi, serta fasilitas umum (toilet, musala, parkir, halte) terimpor secara otomatis dalam hitungan detik.

### 3. Integrasi Data Terbuka Pemerintah (B2G Integration)
Wistara dapat terhubung langsung dengan inisiatif data pariwisata pemerintah:
- **JADESTA Kemenparekraf** (*Jejaring Desa Wisata Indonesia*): Database resmi ribuan desa wisata di seluruh Indonesia.
- **Satu Data Indonesia / Open Data Pemda**: Data buku tarif retribusi tempat rekreasi daerah yang tersedia dalam format data terbuka (CSV/API).

### 4. Portal Mandiri Pengelola Destinasi (*Wistara Partner Portal*)
Mengadopsi model *Google Business Profile* atau *Traveloka Partner*:
- Pengelola wisata lokal (Pokdarwis, BUMDes, atau Dinas Pariwisata setempat) diberi dashboard gratis untuk mengklaim dan memperbarui data mereka sendiri (misal: perubahan harga tiket libur lebaran atau jam operasional khusus).

---

## 3. Penjaminan Kualitas: Prinsip *Human-in-the-Loop*

Untuk menjaga kepercayaan wisatawan dan mencegah kesalahan informasi:
1. **Metadata Verifikasi**: Setiap entri memiliki field `verified_at` dan `source_url`.
2. **Persetujuan Satu Klik (*One-Click Verification*)**: Tim kurator atau admin cukup meninjau draf hasil ekstraksi AI selama 15–30 detik sebelum mengaktifkannya ke publik.
3. **Prinsip Kejujuran Data**: Jika informasi tiket atau fasilitas belum terverifikasi dengan pasti, sistem akan menampilkan *"Belum terdata"* daripada menampilkan estimasi spekulatif.

---

## 4. Panduan Menjawab Pertanyaan Evaluator / Juri Lomba

> **Pertanyaan Juri:**  
> *"Data tiket masuk, parkir, dan tips praktis di aplikasi kalian ini didapat dari mana? Apakah dari OpenStreetMap? Dan bagaimana jika destinasinya bertambah ribuan di luar Jogja?"*

> **Jawaban Rekomendasi:**  
> *"Untuk 20 destinasi percontohan saat ini, data fasilitas fisik seperti toilet dan parkir ditarik langsung dari OpenStreetMap, sedangkan data tiket dan panduan praktis dikurasi dari publikasi resmi pengelola destinasi dan regulasi retribusi daerah Pemda DIY.*  
>  
> *Untuk skalabilitas masa depan, arsitektur Wistara dirancang dengan pendekatan **AI-Assisted Ingestion Pipeline**. Kami memanfaatkan LLM dengan kapabilitas penelusuran web untuk mengekstrak informasi tiket dari kanal publikasi resmi pengelola ke dalam skema data terstruktur kami, lalu divalidasi dengan pendekatan Human-in-the-Loop sebelum dipublikasikan."*
