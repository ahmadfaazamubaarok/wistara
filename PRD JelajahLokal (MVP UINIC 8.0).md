# PRD JelajahLokal (MVP UINIC 8.0)

Oct 15, 2026 · @Rani

## Ringkasan produk

JelajahLokal adalah aplikasi web yang memberi tahu wisatawan kapan waktu terbaik mengunjungi sebuah destinasi di DIY dalam 3 hari ke depan, dan apa saja fasilitas di sekitarnya. MVP mencakup 20 destinasi pilihan dan wajib online paling lambat 30 Oktober 2026 untuk babak penyisihan UINIC 8.0.

**Masalah.** Informasi wisata tersebar. Wisatawan mencari destinasi di satu tempat, mengecek cuaca di tempat lain, lalu mencari toilet, parkir, atau halte secara terpisah. Akibatnya mereka mudah datang di jam yang kurang cocok, misalnya ke pantai tepat saat hujan sore.

**Solusi.** Satu halaman per destinasi yang menggabungkan prakiraan BMKG per 3 jam, skor kelayakan kunjungan yang dihitung sesuai jenis destinasi, fasilitas terdekat dari OpenStreetMap, dan saran destinasi indoor saat cuaca buruk.

**Nilai pembeda.** Aplikasi tidak berhenti di "tempat apa yang ada", tetapi menjawab "kapan sebaiknya saya ke sana, dan kalau hujan saya ke mana". Alasan di balik setiap skor ditampilkan, sehingga pengguna bisa menilai sendiri.

**Subtema lomba.** Sosial Budaya, dengan landasan [SDG target 8.9](https://sdgs.un.org/goals/goal8) tentang pariwisata berkelanjutan yang mempromosikan budaya dan produk lokal. Rincian teknis ada di dokumen Rancangan Teknis JelajahLokal, PRD ini fokus pada apa yang dibangun dan bagaimana menilai berhasil atau tidaknya.

## Tujuan dan metrik keberhasilan

Tujuan utama MVP adalah lolos ke 15 besar semifinal dengan produk yang benar-benar berjalan, bukan sekadar konsep. Semua target di bawah ditetapkan tim sendiri dan diukur sebelum proposal dikirim.

**Tujuan.**

1. Pengguna bisa menentukan slot kunjungan terbaik untuk satu destinasi dalam waktu kurang dari 1 menit.
2. Pengguna bisa menemukan fasilitas dasar (toilet, parkir, tempat makan) di sekitar destinasi tanpa membuka aplikasi lain.
3. Saat cuaca buruk, pengguna mendapat alternatif yang masuk akal, bukan hanya peringatan.
4. Juri bisa melihat bukti rekayasa yang solid, yaitu API terdokumentasi, keamanan dasar, dan ketahanan saat sumber data gagal.

**Non-tujuan untuk MVP.** Pemesanan tiket, ulasan pengguna, jadwal transportasi real-time, prakiraan lebih dari 3 hari, cakupan di luar DIY, dan aplikasi mobile native.

| Metrik | Target | Cara ukur | Kapan |
| --- | --- | --- | --- |
| Tingkat keberhasilan tugas | Minimal 80% dari seluruh percobaan tugas | Uji pengguna, 5 tugas | 25-26 Okt |
| Waktu menemukan slot terbaik | Median di bawah 60 detik | Stopwatch saat uji pengguna | 25-26 Okt |
| Skor SUS | Dilaporkan apa adanya, dibandingkan dengan acuan interpretasi SUS yang sudah diverifikasi sumbernya | Kuesioner SUS 10 butir | 26 Okt |
| Kesesuaian label skor | Minimal 70% responden setuju label sesuai penilaian mereka | 3 pertanyaan kalibrasi | 26 Okt |
| Kesegaran data cuaca | Data tidak lebih tua dari 13 jam di semua destinasi | `GET /api/v1/health` | Harian sampai 27 Nov |
| Respons API dari cache | p95 di bawah 1 detik | Uji beban ringan atau log Vercel | 24 Okt |
| Aksesibilitas | Skor Lighthouse Accessibility minimal 90 | Lighthouse | 24 Okt |
| Keamanan dasar | Nol temuan kritis, input tidak valid ditolak, rencana orang lain tidak bisa diakses | Tes integrasi | 24 Okt |

## Target pengguna

Target utama adalah wisatawan domestik yang merencanakan kunjungan ke DIY 1 sampai 3 hari sebelumnya, sesuai jangkauan prakiraan BMKG. Ketiga persona di bawah adalah **hipotesis tim** dan harus dicek ulang dengan hasil uji pengguna, bukan data riset.

| Persona | Situasi | Kebutuhan utama | Fitur yang paling relevan |
| --- | --- | --- | --- |
| Keluarga dari luar kota | Akhir pekan 2 hari di Jogja, bawa anak, naik mobil | Tidak mau terjebak hujan di pantai, butuh toilet dan parkir yang jelas | Skor per slot, fasilitas, alternatif indoor |
| Mahasiswa lokal | Jalan spontan bareng teman naik motor, anggaran terbatas | Tahu besok pagi atau sore yang lebih cocok, cari tempat makan dan masjid di sekitar | Skor per slot, fasilitas, rute |
| Wisatawan pengguna transportasi umum | Tidak membawa kendaraan, mengandalkan bus atau kereta | Halte atau stasiun terdekat dan jaraknya | Akses dan rute, fasilitas |

**Batasan pengguna.** Aplikasi tidak ditujukan untuk perencanaan lebih dari 3 hari ke depan, dan tidak menggantikan informasi resmi pengelola destinasi soal penutupan atau keselamatan.

## Posisi terhadap produk yang sudah ada

Pembanding terkuat sudah menyediakan cuaca dan peta, jadi pembeda JelajahLokal harus ada di penerjemahan cuaca menjadi keputusan kunjungan per jenis destinasi. Klaim di tabel ini dicek pada 15 Oktober 2026.

| Kebutuhan | Google Maps | Info BMKG | JelajahLokal |
| --- | --- | --- | --- |
| Peta, rute, tempat di sekitar | Sangat lengkap | Tidak menjadi fokus | Terbatas pada 20 destinasi dan fasilitas OSM, rute diarahkan ke Google Maps |
| Cuaca | Kondisi saat ini dan prakiraan 6 jam di Android, data dari The Weather Channel ([Android Central](https://www.androidcentral.com/apps-software/google-maps-for-android-shows-weather-data)) | Prakiraan 7 hari per kecamatan, peringatan dini, cuaca maritim termasuk tinggi gelombang ([App Store](https://apps.apple.com/fr/app/info-bmkg/id1114372539)) | Prakiraan 3 hari per 3 jam dari API publik BMKG |
| Menilai apakah cuaca cocok untuk jenis destinasi tertentu | Tidak ada | Tidak ada, pengguna menafsirkan sendiri | Skor per kategori beserta alasannya |
| Saran pengganti saat cuaca buruk | Tidak ada | Tidak ada | Destinasi indoor terdekat dengan skor lebih baik |
| Rencana kunjungan dengan slot waktu | Daftar tersimpan tanpa konteks cuaca | Tidak ada | Rencana per slot dengan skor terkini |

**Di mana JelajahLokal kalah, dan harus diakui di proposal.** Info BMKG punya prakiraan 7 hari, sedangkan API publik yang bisa dipakai pengembang hanya menyediakan 3 hari. Google Maps jauh lebih lengkap untuk tempat dan rute. Karena itu JelajahLokal tidak bersaing di kelengkapan data, melainkan di keputusan "kapan dan ke mana" yang belum dijawab keduanya.

Juri hampir pasti akan bertanya "kenapa tidak pakai Info BMKG saja?" Jawaban yang disiapkan adalah bahwa Info BMKG memberi data cuaca, sedangkan JelajahLokal memberi rekomendasi kunjungan yang sudah memperhitungkan jenis destinasi, jam buka, fasilitas, dan alternatif.

## Ruang lingkup rilis MVP

Rilis 30 Oktober memuat 9 fitur P0. Fitur P1 hanya dikerjakan jika semua P0 sudah berjalan pada 24 Oktober, dan fitur yang tidak selesai tidak boleh disebut sebagai fitur di proposal.

| Kode | Fitur | Prioritas |
| --- | --- | --- |
| F1 | Peta destinasi dan filter kategori | P0 |
| F2 | Prakiraan cuaca per destinasi | P0 |
| F3 | Skor kelayakan kunjungan per slot 3 jam | P0 |
| F4 | Fasilitas sekitar dengan jarak | P0 |
| F5 | Alternatif indoor saat cuaca buruk | P0 |
| F6 | Akses (halte, stasiun) dan tombol rute | P0 |
| F7 | Rencana kunjungan untuk pengguna yang login | P0 |
| F8 | Transparansi sumber dan kesegaran data | P0 |
| F9 | API publik dengan dokumentasi OpenAPI | P0 |
| F10 | Banner peringatan dini BMKG | P1 |
| F11 | Destinasi terbaik lintas daftar untuk satu slot | P1 |

**Cakupan data.** 20 destinasi di DIY, sekitar 4 per kategori (pantai, alam, budaya, museum, desa wisata). Bahasa antarmuka Bahasa Indonesia. Tampilan mobile-first yang tetap layak di desktop.

**Tidak masuk MVP (ditulis sebagai rencana lanjutan).** Rekomendasi berbasis preferensi dengan AI, ulasan pengguna, jadwal Trans Jogja langsung, tinggi gelombang untuk pantai, kota lain di luar DIY, mode offline, dan dukungan bahasa Inggris.

## User story dan kriteria penerimaan

Sebuah fitur dianggap selesai hanya jika semua kriterianya tercentang di website yang sudah ter-deploy, bukan di laptop. Centang dilakukan saat QA pada 24 Oktober.

### F1. Peta destinasi dan filter kategori

Sebagai wisatawan, saya ingin melihat destinasi di peta dan menyaringnya per jenis, agar cepat menemukan tempat yang sesuai minat.

- [ ] Beranda menampilkan 20 penanda destinasi dan daftar yang sama di samping atau di bawah peta.
- [ ] Filter kategori bisa memilih lebih dari satu kategori, dan peta serta daftar diperbarui tanpa memuat ulang halaman.
- [ ] Pilihan hari (Hari ini, Besok, Lusa) mengubah warna penanda sesuai skor slot terbaik hari itu.
- [ ] Semua isi peta bisa diakses lewat daftar, tanpa harus memakai peta.
- [ ] Atribusi OpenFreeMap, OpenMapTiles, dan OpenStreetMap terlihat di peta.

### F2. Prakiraan cuaca per destinasi

Sebagai wisatawan, saya ingin melihat prakiraan cuaca di destinasi per beberapa jam, agar bisa membandingkan pagi, siang, dan sore.

- [ ] Halaman detail menampilkan slot 3 jam untuk 3 hari dalam waktu WIB.
- [ ] Setiap slot memuat kondisi cuaca, suhu (°C), kecepatan angin (km/jam), dan kelembapan (%).
- [ ] Waktu produksi prakiraan dan atribusi BMKG terlihat di halaman.
- [ ] Jika data lebih tua dari 13 jam, muncul label "Data belum diperbarui" beserta waktunya.

### F3. Skor kelayakan kunjungan

Sebagai wisatawan, saya ingin tahu slot mana yang paling cocok untuk destinasi ini, agar tidak salah memilih waktu berangkat.

- [ ] Setiap slot yang buka memiliki skor 0 sampai 100 dan satu label (Sangat sesuai, Cukup sesuai, Kurang sesuai).
- [ ] Label dibedakan dengan warna, ikon, dan teks sekaligus.
- [ ] Maksimal 3 alasan ditampilkan, diurutkan dari penalti terbesar.
- [ ] Slot di luar jam buka bertuliskan "Tutup" tanpa skor.
- [ ] Tes otomatis untuk dua contoh hitungan di rancangan teknis menghasilkan skor 100 dan 25.
- [ ] Halaman Tentang Data menjelaskan rumus dan bobot, serta menyatakan bahwa skor bukan jaminan kondisi di lokasi.

### F4. Fasilitas sekitar

Sebagai wisatawan yang membawa keluarga, saya ingin tahu toilet, parkir, tempat makan, dan masjid terdekat, agar tidak perlu mencari di aplikasi lain.

- [ ] Radius bawaan 1.000 m dan bisa diganti ke 500 m atau 2.000 m.
- [ ] Fasilitas dikelompokkan per tipe, diurutkan dari yang terdekat, dengan jarak dalam meter.
- [ ] Fasilitas juga tampil di peta kecil halaman detail.
- [ ] Jika satu tipe tidak ditemukan, tampil keterangan "Belum terpetakan di OpenStreetMap", bukan bagian kosong.

### F5. Alternatif saat cuaca buruk

Sebagai wisatawan, saya ingin mendapat pilihan lain saat destinasi saya diprakirakan hujan, agar rencana hari itu tetap berjalan.

- [ ] Kartu alternatif hanya muncul jika skor slot di bawah 50 dan penalti terbesarnya hujan.
- [ ] Kartu memuat maksimal 3 destinasi indoor dalam radius 15 km yang buka di slot itu dan berskor minimal 60, diurutkan dari yang terdekat.
- [ ] Jika tidak ada destinasi yang memenuhi, kartu menyarankan slot lain di destinasi yang sama dengan skor tertinggi.

### F6. Akses dan rute

Sebagai wisatawan tanpa kendaraan pribadi, saya ingin tahu halte atau stasiun terdekat dan bisa langsung membuka rute, agar mudah merencanakan perjalanan.

- [ ] Halte dan stasiun terdekat tampil beserta nama (jika ada di OSM) dan jaraknya.
- [ ] Tombol "Buka rute" membuka Google Maps di tab baru dengan tujuan koordinat destinasi.
- [ ] Tombol berfungsi di ponsel tanpa harus login apa pun.

### F7. Rencana kunjungan

Sebagai wisatawan, saya ingin menyimpan daftar destinasi dengan slot waktu pilihan, agar bisa membukanya lagi di hari keberangkatan.

- [ ] Pengguna bisa mendaftar dan login dengan email dan kata sandi.
- [ ] Pengguna bisa membuat rencana berjudul 1 sampai 80 karakter, menambah destinasi beserta slot, dan menghapusnya.
- [ ] Halaman rencana menampilkan skor terkini untuk setiap destinasi pada slot yang dipilih.
- [ ] Pengguna lain tidak bisa melihat atau mengubah rencana tersebut, dibuktikan dengan tes integrasi.
- [ ] Pengguna yang belum login dan menekan "Simpan" diarahkan ke login, lalu kembali ke halaman semula.

### F8. Transparansi data

Sebagai wisatawan, saya ingin tahu dari mana data berasal dan kapan diperbarui, agar bisa menilai seberapa bisa dipercaya.

- [ ] Setiap halaman yang memakai data BMKG menampilkan atribusi BMKG.
- [ ] Peta menampilkan atribusi OpenStreetMap dengan tautan ke halaman lisensinya.
- [ ] Halaman Tentang Data memuat daftar sumber, lisensi, waktu pembaruan terakhir per sumber, dan metodologi skor.

### F9. API publik

Sebagai pengembang lain atau juri, saya ingin mengakses data JelajahLokal lewat API yang terdokumentasi, agar sistem ini bisa diintegrasikan dengan layanan lain.

- [ ] Semua endpoint publik di rancangan teknis tersedia dan mengembalikan JSON.
- [ ] `/api/docs` menampilkan spesifikasi OpenAPI yang sesuai dengan perilaku sebenarnya.
- [ ] Input tidak valid ditolak dengan status 400 dan format error yang seragam.
- [ ] `GET /api/v1/health` menunjukkan status database dan kesegaran data BMKG.

## Kebutuhan non-fungsional

Kebutuhan ini langsung menjawab tema lomba (scalable, high availability, keamanan proaktif) dan kriteria Kualitas Teknis. Cara implementasinya ada di bagian Keamanan dan ketahanan pada rancangan teknis.

| Kategori | Kebutuhan | Ukuran |
| --- | --- | --- |
| Ketersediaan | Website tetap bisa diakses dan menampilkan data terakhir saat BMKG gagal diakses | Respons API tetap 200 dengan `isStale: true` pada uji kegagalan |
| Ketersediaan | Demo tetap hidup sampai final 27 November 2026 | Pengecekan `/health` harian, proyek database tidak pernah dijeda |
| Performa | Halaman detail terasa cepat di ponsel | Respons API dari cache p95 di bawah 1 detik, skor Lighthouse Performance dicatat di proposal |
| Skalabilitas | Beban pengguna tidak menambah beban ke BMKG | Permintaan ke BMKG per wilayah maksimal sekali per 6 jam, berapa pun jumlah pengguna |
| Kepatuhan sumber data | Batas akses dan syarat atribusi dipatuhi | Maksimal 60 permintaan per menit ke BMKG, atribusi BMKG dan OSM tampil, Overpass tidak dipanggil saat runtime |
| Keamanan | Input divalidasi, akses data dibatasi per pengguna, rahasia tidak ada di repository | Tes integrasi 400, 401, dan akses silang lulus, pemindaian rahasia di repository bersih |
| Privasi | Data pribadi seminimal mungkin | Yang disimpan hanya email dan rencana kunjungan. Lokasi perangkat hanya dipakai di browser dan tidak disimpan |
| Aksesibilitas | Bisa dipakai tanpa mengandalkan warna dan tanpa mouse | Lighthouse Accessibility minimal 90, semua aksi bisa dijalankan dengan keyboard |
| Kompatibilitas | Berjalan di browser modern ponsel dan desktop | Dites di Chrome Android dan satu browser desktop |
| Keterpeliharaan | Kode modular dan mudah dibaca juri | Fungsi skor terpisah dan teruji, README menjelaskan struktur folder dan cara menjalankan |

## Asumsi, ketergantungan, dan pertanyaan terbuka

Asumsi terbesar adalah bahwa wisatawan memang merencanakan kunjungan 1 sampai 3 hari sebelumnya. Jika uji pengguna menunjukkan sebaliknya, nilai produk ini perlu dibingkai ulang di proposal.

**Asumsi.**

- Wisatawan menganggap informasi "kapan sebaiknya datang" cukup penting untuk membuka aplikasi khusus.
- Bobot dan ambang skor yang disusun tim cukup masuk akal, dan akan dikalibrasi lewat uji pengguna.
- Data fasilitas OpenStreetMap di sekitar 20 destinasi terpilih cukup lengkap untuk demo.
- Kedua anggota tim bisa bekerja dengan Next.js dan TypeScript dalam 15 hari.

**Ketergantungan eksternal.**

| Ketergantungan | Risiko jika bermasalah | Cadangan |
| --- | --- | --- |
| API publik BMKG | Prakiraan tidak bisa diperbarui | Tampilkan data terakhir dengan label belum diperbarui |
| OpenFreeMap (tanpa SLA) | Peta dasar tidak tampil | Daftar destinasi dan fasilitas tetap bisa dipakai tanpa peta |
| Supabase dan Vercel paket gratis | Proyek dijeda atau kuota habis | Cron harian dan pemantauan `/health` |
| Data OSM | Fasilitas kosong di beberapa destinasi | Ganti destinasi atau tambah data kurasi dengan sumber jelas |

**Pertanyaan terbuka.**

- [ ] Apakah stack Next.js disetujui kedua anggota, atau perlu pindah ke Laravel? Belum ada jawaban di komentar rancangan teknis.
- [ ] Daftar final 20 destinasi dan siapa yang memverifikasi jam buka masing-masing.
- [ ] Login memakai email saja, atau juga Google?
- [ ] Siapa yang merekrut 10 sampai 15 responden uji pengguna, dan dari mana.
- [ ] Nama produk tetap JelajahLokal atau diganti setelah dicek tidak bentrok dengan produk lain.

## Milestone rilis

Empat tanggal menentukan nasib MVP. Feature freeze dan QA kriteria penerimaan pada Oct 24, 2026, uji pengguna selesai pada Oct 26, 2026, pengumpulan proposal dan repository pada Oct 30, 2026 (targetkan siang, batas panitia 23.59 WIB), dan pengumuman semifinalis pada Nov 5, 2026. Pembagian tugas harian, arsitektur, skema database, desain API, dan logika skor ada di Rancangan Teknis JelajahLokal (MVP UINIC 8.0).

**Sumber.** Guidebook Web Development Competition UINIC 8.0 (berkas PDF dari panitia), [BMKG Prakiraan Cuaca](https://data.bmkg.go.id/prakiraan-cuaca/), [Info BMKG di App Store](https://apps.apple.com/fr/app/info-bmkg/id1114372539), [Android Central tentang cuaca di Google Maps](https://www.androidcentral.com/apps-software/google-maps-for-android-shows-weather-data), [SDG Goal 8](https://sdgs.un.org/goals/goal8).
