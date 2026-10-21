# Keunggulan Wistara Dibanding Platform Serupa (Google Maps, Gemini, OTA)

Dokumen ini memaparkan proposisi nilai, analisis komparatif, dan inovasi arsitektural **Wistara** dibandingkan dengan platform umum seperti **Google Maps (termasuk fitur AI Gemini)**, **TripAdvisor**, dan **Online Travel Agent (OTA / Traveloka / Tiket.com)**.

> **Status verifikasi (22 Okt 2026).** Klaim tentang Google Maps sudah diperiksa lewat pencarian publik (sumber di bagian 5) dan beberapa klaim lama dikoreksi: Google Maps ternyata sudah menampilkan prakiraan beberapa jam dan kini punya AI percakapan (*Ask Maps*) di Indonesia. Klaim tentang **chatbot umum dan OTA tidak dapat diverifikasi** dan ditandai ❔; jangan dikutip sebagai fakta di proposal. Klaim tentang Wistara sendiri dicocokkan dengan kode dan data.

---

## 1. Ringkasan Eksekutif

Banyak wisatawan mengandalkan Google Maps untuk mencari tempat dan petunjuk arah, atau bertanya ke chatbot AI untuk membuat rencana perjalanan (*itinerary*). Namun, dalam skenario nyata di Daerah Istimewa Yogyakarta:
1. **Google Maps** sangat baik untuk navigasi dan ulasan keramaian. Di Android ia juga menampilkan cuaca area di peta dan prakiraan sekitar 6 jam (sumber The Weather Channel). Yang tidak dilakukannya adalah **menggabungkan cuaca, jam buka, dan jarak menjadi satu penilaian kelayakan per destinasi**, dan ia tidak memakai prakiraan BMKG per desa untuk 3 hari ke depan (misalnya: apakah jam 15.00 masih nyaman ke pantai dan bagaimana status gelombangnya, atau candi sedang terik menyengat).
2. **AI percakapan kini ada di dalam Google Maps sendiri** (*Ask Maps*, berbasis Gemini, hadir di Indonesia sejak Agustus 2026) dan jawabannya bersumber dari data Maps, sehingga jauh lebih terlandasi daripada chatbot umum. Yang tidak dimilikinya, sejauh bisa kami verifikasi, adalah penilaian berbasis prakiraan BMKG per slot 3 jam, status gelombang, dan aturan kejujuran data seperti Wistara. **Chatbot umum tanpa data terstruktur** tetap rawan keliru soal rute, jarak, atau jam buka.
3. **Platform OTA (Traveloka / TripAdvisor)** bersifat komersial dan berfokus pada penjualan tiket/hotel, bukan optimasi keputusan waktu berkunjung di lapangan.

**Wistara memposisikan diri bukan sebagai kompetitor langsung yang menggantikan Google Maps, melainkan sebagai *Intelligent Decision Layer* (Mesin Pengambil Keputusan Cerdas)** yang menggabungkan data cuaca mikro resmi BMKG, basis data spasial lokal 365 destinasi & 1.337 fasilitas DIY, serta menautkan Google Maps untuk navigasi, ulasan, dan foto.

---

## 2. Matriks Perbandingan Fitur

Legenda: **✅** dimiliki dan terverifikasi · **⚠️** sebagian atau dengan catatan · **❔** tidak dapat diverifikasi.

| Dimensi Fitur | Google Maps (+ Ask Maps / Gemini) | AI Chatbot Umum | Platform OTA | **Wistara** |
| :--- | :--- | :--- | :--- | :--- |
| **Skor Kelayakan Cuaca per Jam (0–100)** | ⚠️ Cuaca area dan prakiraan ±6 jam di Android; tanpa skor kelayakan per destinasi | ❔ | ❔ | **✅ Prakiraan 3-jam BMKG berbasis kode desa/kelurahan, dihitung per destinasi** |
| **Saran Alternatif Saat Hujan / Terik Ekstrem** | ⚠️ Bisa ditanyakan ke Ask Maps; tidak berbasis prakiraan BMKG per slot | ⚠️ Rawan keliru tanpa data terstruktur | ❔ | **✅ Otomatis (destinasi indoor/museum terdekat dengan skor pada slot yang sama)** |
| **Peringatan Dini Cuaca Ekstrem BMKG (CAP)** | ⚠️ Public Alerts memuat peringatan gempa dan tsunami BMKG (sejak 2018); peringatan cuaca ekstrem BMKG tidak terkonfirmasi; tidak dikaitkan ke destinasi | ❔ | ❔ | **✅ Banner di destinasi yang berada di wilayah terdampak, memuat instruksi dari BMKG** |
| **Status Kondisi Laut untuk Pantai (prakiraan gelombang BMKG per slot)** | ⚠️ Tidak ditemukan fitur prakiraan gelombang (pencarian 22 Okt 2026) | ❔ | ❔ | **✅ Perhatian / Waspada / Bahaya per slot 3 jam untuk 50 pantai di 3 wilayah perairan DIY, ditulis sebagai prakiraan wilayah perairan** |
| **Fasilitas Mikro Sekitar (Toilet, Parkir, Musala)** | ⚠️ Harus dicari satu per satu | ❔ | ❔ | **✅ Terpetakan per radius 500 m, 1 km, dan 2 km (82 toilet, 1.337 fasilitas DIY)** |
| **Rencana 1 Hari Berbasis Skor dan Jam Buka** | ⚠️ Multi-perhentian tersedia dan Gemini dapat menambah perhentian; tidak mengurutkan menurut skor cuaca per slot BMKG | ⚠️ Jam dan urutan bisa tidak realistis tanpa data terstruktur | ❔ | **✅ Dari skor per slot, jam buka, dan estimasi waktu tempuh kasar; konflik (mis. tempat tutup) disebutkan terus terang** |
| **Rute Kendaraan Umum Lokal (Trans Jogja, KRL, Bandara)** | ⚠️ Rute transit tersedia di Google Maps; kesegaran data Trans Jogja dan KRL tidak kami verifikasi | ❔ | ❔ | **⚠️ Tautan 1-klik ke mode transit Google Maps. Wistara hanya menautkan; data transitnya milik Google** |
| **Katalog Wisata DIY dengan Skor Kelayakan** | ⚠️ Cakupan tempat jauh lebih luas, tetapi tanpa skor kelayakan | ❔ | ❔ | **✅ 365 destinasi di 5 kab/kota (alam, museum, budaya, pantai, desa wisata)** |
| **Data Destinasi Dikurasi Bersama Pengelola** | ⚠️ Pengelola dapat memperbarui profil bisnis (bukan data cuaca atau kelayakan) | ❔ | ❔ | **✅ Pengelola, pemilik, atau pemerintah desa mengusulkan destinasi baru; ditinjau admin sebelum tayang. Pembaruan destinasi yang sudah ada belum tersedia** |
| **Pengalaman Pengguna (penilaian tim, bukan pengukuran)** | ⚠️ Ada hasil bersponsor di Maps | ❔ | ❔ | **✅ Tanpa iklan, antarmuka bersih** |

> **Cara membaca.** Kolom Google Maps diperiksa pada 22 Okt 2026 lewat pencarian publik. Fitur Google berubah cepat dan ketersediaannya berbeda per wilayah dan perangkat, jadi **periksa langsung di aplikasi sebelum proposal dikirim**. Sel ❔ berarti tidak ada bukti yang bisa kami rujuk; jangan ditulis sebagai "tidak ada" di proposal.

---

## 3. Pilar Keunggulan Utama Wistara

### A. *Weather-Aware Scoring Engine* (Keputusan Berbasis Cuaca Mikro)
- Wisata di Yogyakarta sangat dipengaruhi oleh mikroklimat: pesisir selatan berangin kencang, lereng Merapi sering berkabut/hujan siang hari, dan pusat kota terasa menyengat di siang bolong.
- Wistara menghitung **Skor Waktu Terbaik (0–100)** untuk setiap blok 3 jam dari prakiraan resmi BMKG, dengan empat faktor: **hujan, angin, panas (suhu), dan jarak pandang**. Bobot dan ambangnya adalah asumsi desain tim dan dijelaskan di halaman "Tentang Data".
- Wisatawan tidak lagi bertanya *"Apakah hari ini Jogja hujan?"*, melainkan langsung melihat penilaian per jam, misalnya *"Pukul 09.00 adalah waktu terbaik ke Candi Ijo (skor 92), sedangkan pukul 15.00 disarankan pindah ke Museum Ullen Sentalu karena diprediksi hujan lebat."* (contoh ilustrasi, bukan keluaran nyata).

### B. Basis Data Fasilitas Mikro & Toilet Publik Se-DIY
- Salah satu keluhan utama wisatawan keluarga, lansia, dan rombongan bus adalah kesulitan menemukan **toilet publik yang layak, tempat ibadah, dan area parkir** saat berada di destinasi alam atau candi.
- Wistara memetakan **82 toilet** serta total **1.337 titik fasilitas** (toilet, parkir, tempat makan, tempat ibadah, ATM, halte, stasiun) dari data OpenStreetMap se-DIY, dengan pilihan radius 500 m, 1 km, dan 2 km di aplikasi (API hingga 3 km).

### C. Sinergi dengan Google Maps (Bukan Meniru atau Melawan)
- Google Maps adalah acuan yang kuat untuk ulasan dan foto pengguna serta navigasi *turn-by-turn*.
- Alih-alih membuat peta rute tiruan, Wistara menyediakan **tautan keluar ke Google Maps**:
  1. **Profil, Ulasan & Foto Pengunjung**: tautan ke halaman tempat di Google Maps, tanpa menyalin atau menyimpan datanya.
  2. **Rute Kendaraan Umum**: tautan dengan parameter resmi `&travelmode=transit`, sehingga wisatawan membuka opsi transit yang tersedia di Google Maps (Trans Jogja, KRL Commuter Line Yogya–Solo, KA Bandara YIA, sejauh datanya ada di sana). Wistara tidak menyimpan atau menjamin jadwalnya.
  3. **Navigasi GPS Pribadi**: tautan 1-klik untuk pengendara mobil dan sepeda motor.

### D. Asisten AI Wistara yang Ter-Grounding Faktual
- Chatbot AI Wistara dibangun di atas mesin aturan deterministik (*deterministic engine*) yang dirapikan oleh Gemini LLM (opsional; tanpa model, mesin kode tetap menjawab).
- AI tidak diperkenankan "mengarang" jam operasional, harga tiket, atau titik lokasi; teks model yang memuat angka atau nama destinasi di luar fakta dibuang. Jika suatu destinasi tutup pada hari Senin atau berada di luar jangkauan prakiraan 3 hari, AI akan secara tegas memberi tahu wisatawan dan memberikan alternatif yang relevan.
- Riwayat obrolan tersimpan di sesi browser (*sessionStorage*), sehingga tidak hilang saat wisatawan berpindah tab atau mengeksplorasi peta.

### E. Kondisi Laut yang Jujur untuk Pantai Selatan
- Pantai selatan DIY punya risiko khusus (gelombang tinggi dan arus balik). Wistara menampilkan **prakiraan maritim BMKG per slot 3 jam** untuk 50 pantai di tiga wilayah perairan: P.N.01 (Kulonprogo), P.N.02 (Bantul), dan P.N.03 (Gunungkidul).
- Status diturunkan dari kondisi **terburuk** dalam slot: gelombang Tenang atau Rendah menjadi *Perhatian*, Sedang menjadi *Waspada*, Tinggi ke atas menjadi *Bahaya*. Hembusan angin di atas 25 knot menaikkan status satu tingkat (asumsi desain tim, bukan standar BMKG atau SAR, dan ditulis begitu).
- **Kata "aman" sengaja tidak dipakai.** Status berlaku untuk wilayah perairan, bukan jaminan kondisi di bibir pantai; data maritim lebih tua dari 24 jam diperlakukan sebagai "data laut belum tersedia"; wisatawan tetap diminta mengikuti arahan petugas di lokasi.
- Status laut adalah indikator **terpisah** dari skor cuaca 0–100 (skor diberi label "Cuaca darat"), sehingga cuaca darat yang bagus tidak menutupi gelombang tinggi. Pantai berstatus Bahaya juga didorong ke bawah pada daftar "Rekomendasi Terbaik Hari Ini".

### F. Katalog yang Bisa Tumbuh Bersama Pengelola
- Katalog 365 destinasi diimpor dari OpenStreetMap dan disaring ke batas wilayah DIY. Pengelola, pemilik, atau pemerintah desa dapat **mengusulkan destinasi baru** lewat formulir; lokasi dipilih di peta dan **divalidasi di server** terhadap batas DIY, dan kabupaten serta alamat disarankan otomatis dari peta (tetap bisa diubah).
- Usulan **tidak pernah langsung tayang**: admin meninjau lokasi, wilayah cuaca, dan kandidat duplikat lebih dulu. Tanggal verifikasi jam buka hanya terisi bila admin menegaskan jam buka sudah dikonfirmasi ke pengelola.
- Nomor WhatsApp pengusul adalah data pribadi: hanya terbaca oleh pengusul dan admin, tidak muncul di API publik, dan dihapus bila usulan ditolak.
- Batasan yang jujur: saat ini pengelola baru bisa mengusulkan destinasi **baru**; memperbarui data destinasi yang sudah ada belum tersedia. Baru 12 dari 365 destinasi yang jam bukanya terverifikasi ke pengelola.

### G. Desain Bersih, Ringan, & Fokus pada Data (Anti "AI Slop")
- Antarmuka Wistara dirancang dengan estetika minimalis modern (*clean architecture*).
- Menghindari emoji berlebihan, banner iklan komersial, atau dekorasi yang mengaburkan informasi esensial. Setiap elemen visual memiliki fungsi nyata untuk membantu wisatawan membuat keputusan.

---

## 4. Kesimpulan untuk Penguji & Juri

> *"Google Maps memberi tahu Anda **di mana** lokasinya dan **bagaimana cara ke sana**.  
> Wistara memberi tahu Anda **kapan waktu terbaik ke sana**, **apakah cuacanya mendukung**, **bagaimana status gelombangnya bila itu pantai**, dan **apa yang harus dilakukan jika mendadak hujan**, lalu menautkan ke Google Maps untuk rute dan ulasan."*

Wistara mengintegrasikan beberapa sumber data resmi terbuka (BMKG prakiraan darat dan maritim, dan OpenStreetMap) menjadi satu antarmuka yang terfokus untuk memecahkan masalah nyata wisatawan di Daerah Istimewa Yogyakarta, dan menautkan Google Maps untuk navigasi dan ulasan.

---

## 5. Sumber Verifikasi Pesaing (diperiksa 22 Okt 2026)

- [Android Central: Google Maps untuk Android menampilkan data cuaca](https://www.androidcentral.com/apps-software/google-maps-for-android-shows-weather-data). Rincian "prakiraan ±6 jam, sumber The Weather Channel" diambil dari ringkasan hasil pencarian karena isi artikel tidak dapat dibuka penuh saat verifikasi; tanggal terbitnya tidak terkonfirmasi.
- [Google Indonesia: Ask Maps kini hadir di Indonesia](https://blog.google/intl/id-id/products/explore-get-answers/ask-maps-kini-hadir-di-indonesia/) (6 Agustus 2026): peluncuran dalam bahasa Indonesia dan Inggris.
- [CNBC Indonesia, 13 Maret 2026](https://www.cnbcindonesia.com/tech/20260313123831-37-718764/google-maps-makin-canggih-bisa-cari-tempat-ngecas-hp-terdekat): jawaban Gemini di Maps bersumber dari data Maps.
- [Tempo: Google meluncurkan Public Alerts tsunami di Indonesia](https://en.tempo.co/amp/609028/google-launches-tsunami-public-alerts-in-indonesia) (2018): Public Alerts di Indonesia bermitra dengan BMKG untuk gempa dan tsunami.

**Yang dicari tetapi tidak ditemukan buktinya:** fitur prakiraan gelombang di Google Maps; peringatan cuaca ekstrem BMKG di Google Public Alerts pada 2026; data Trans Jogja atau KRL yang *real-time* di Google Maps; fitur cuaca atau penilaian kelayakan pada TripAdvisor dan Traveloka. Itu sebabnya sel terkait ditandai ⚠️ atau ❔, bukan ❌.
