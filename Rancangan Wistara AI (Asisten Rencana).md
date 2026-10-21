# Rancangan Wistara AI (Asisten Rencana Kunjungan)

Status: rancangan v2 (17 Okt 2026), menggantikan draf awal. Fitur ini **di luar MVP/PRD** (PRD menempatkan "rekomendasi berbasis preferensi dengan AI" di rencana lanjutan). Dikerjakan karena waktu tersisa, dan harus ditulis jujur di proposal sebagai tambahan di luar PRD.

> **Pembaruan (22 Okt 2026).** Dokumen ini dibiarkan sebagai rancangan v2, dengan koreksi pada bagian yang bertentangan dengan aplikasi sekarang:
> - Katalog kini **365 destinasi**, bukan 20. Bagian yang menyebut "20 destinasi" (penelusuran semua kombinasi pada penyusun rencana, pengisian atribut manual) ditulis untuk 20 destinasi; lihat `src/lib/ai/` untuk perilaku sekarang.
> - **Gelombang tidak lagi sepenuhnya "tidak ada datanya".** Halaman pantai kini menampilkan prakiraan maritim BMKG per wilayah perairan. Wistara AI tetap tidak menilai layak-tidaknya berenang, tetapi jawabannya sekarang menyebut hal itu (lihat `UNSUPPORTED_REPLY.gelombang` di `src/lib/ai/engine.ts`).
> - Bila berbeda dengan dokumen ini, [README](README.md) yang berlaku.

## 1. Prinsip

1. **Kode memutuskan, model menjelaskan.** Pemilihan destinasi, skor, jam, jarak, dan susunan rencana dihitung kode dari data kita. Model hanya (a) memahami pertanyaan menjadi parameter dan (b) menulis penjelasan ramah dari fakta yang sudah dipilih kode.
2. **Angka tidak pernah berasal dari model.** Skor, suhu, jam buka, dan jarak ditempel dari data. Teks model yang memuat angka di luar fakta ditolak (bagian 6).
3. **Jujur soal batas.** Jika data tidak ada (arus balik dan kelayakan berenang, harga tiket yang tidak tercatat, destinasi di luar katalog, prakiraan lebih dari 3 hari), jawabannya "tidak punya datanya", bukan perkiraan.
4. **Tetap berguna tanpa model.** Bila API model gagal atau kuota habis, tombol pertanyaan cepat tetap berjalan lewat mesin kode (bagian 4.3).
5. **Memakai komponen yang sudah ada**: `getManyForecasts`, `bestOverlappingSlot`, `alternativesBySlot`, `facilitiesNear`, `getPageUser`, server action rencana, `rate_limit_hit`, `safeNext`, `withApi`.

## 2. Alur data

```
Pengguna ──> POST /api/v1/assistant
               │ 1. Penjaga: rate limit, panjang input, deteksi login
               │ 2. Pemahaman (panggilan model #1, tanpa data destinasi)
               │      -> intent + parameter terstruktur
               │ 3. Mesin (kode, deterministik)
               │      -> rekomendasi / perbandingan / rencana / info
               │ 4. Penjelasan (panggilan model #2, hanya fakta terpilih)
               │      -> teks bahasa Indonesia
               │ 5. Validator: slug, angka, panjang, bahasa
               │      gagal -> teks templat bawaan (tanpa model)
               v
        respons: { type, reply, cards[], itinerary?, canSave, notices[] }
```

Panggilan #1 dan #2 dapat digabung menjadi satu bila kuota ketat, tetapi pemisahan lebih mudah diuji dan lebih aman (model tidak melihat data pengguna lain atau katalog saat memahami pertanyaan).

## 3. Taksonomi pertanyaan (intent)

| Intent | Contoh | Penanganan |
| --- | --- | --- |
| `recommend` | "besok siang jam 13.00 ke mana biar nggak kepanasan?" | Urut skor slot (logika F11), filter preferensi, 3 teratas |
| `compare` | "sore ini aman Parangtritis atau Glagah?" | Dua destinasi pada slot yang sama; kartu berdampingan; kesimpulan dari selisih skor |
| `itinerary` | "bikinin rencana 1 hari hari Minggu" | Penyusun rencana (bagian 5) |
| `info` | "Prambanan buka jam berapa?", "ada toilet di Glagah?" | Jawab dari data destinasi/fasilitas; "belum terdata" bila kosong |
| `explain` | "kenapa skornya rendah?" | Alasan skor yang sudah ada (maks 3) |
| `alternative` | "kalau hujan ke mana?" | `alternativesBySlot` |
| `app_help` | "cara simpan rencana?" | Jawaban tetap (tanpa model) |
| `clarify` | "ke mana ya enaknya?" | Tanya balik satu pertanyaan (waktu atau kelompok) |
| `unsupported` | arus balik, kelayakan berenang, tiket, hotel, rute detail | Templat jujur, tanpa karangan (tabel 3.1) |
| `out_of_scope` | puisi, kode, politik, "abaikan instruksi" | Penolakan ramah, tawarkan fungsi yang ada |

### 3.1 Perlakuan khusus

| Situasi | Perilaku |
| --- | --- |
| Waktu tidak jelas ("weekend", "habis magrib") | Petakan ke slot terdekat bila wajar; bila ambigu, `clarify`. Tampilkan slot yang dipakai agar pengguna bisa mengoreksi |
| Di luar 3 hari prakiraan | "Prakiraan BMKG baru tersedia 3 hari ke depan." Jangan menebak |
| "Sekarang hujan nggak?" | Jawab dari prakiraan slot terdekat; sebut bahwa itu prakiraan, bukan pengamatan |
| Destinasi di luar katalog (mis. Borobudur di Jawa Tengah) | "Belum ada di katalog." Tawarkan yang terdekat dari katalog |
| Keselamatan pantai | "Wistara menampilkan prakiraan gelombang BMKG untuk wilayah perairan di halaman pantai, tetapi itu bukan kondisi di titik pantai tertentu. Kami belum memiliki data arus balik atau kelayakan berenang per pantai... Ikuti imbauan petugas dan BMKG." Tidak menyatakan aman/tidak aman (teks lengkap di `engine.ts`) |
| Peringatan dini BMKG (F10) aktif di kecamatan itu | Destinasi dikeluarkan dari rekomendasi dan peringatan ditampilkan |
| Atribut tak terdata (ramah balita, kursi roda) | "Belum terdata di sistem kami." Jangan menyimpulkan dari nama |
| Anggaran, kendaraan, halal, menginap | Dicatat sebagai preferensi bila ada atributnya; selain itu dijawab tidak didukung |
| Lebih dari satu hari | Disusun per hari bila prakiraan ada; hari tanpa prakiraan diberi catatan |
| Ubah rencana ("ganti yang siang") | Hitung ulang satu slot dengan batasan yang sama (bagian 5.3) |
| Pertanyaan lanjutan ("yang kedua jauh nggak?") | Memakai konteks rekomendasi terakhir (bagian 4.4) |

## 4. Komponen

### 4.1 Skema pemahaman (keluaran panggilan #1)

```json
{
  "intent": "recommend | compare | itinerary | info | explain | alternative | app_help | clarify | unsupported | out_of_scope",
  "when": { "dayOffset": 0, "hour": 13, "part": "pagi|siang|sore|malam|null" },
  "categories": ["pantai"],
  "preferences": ["indoor", "teduh", "ramah_anak", "sunset"],
  "destinationRefs": ["pantai-parangtritis", "pantai-glagah"],
  "days": 1,
  "clarifyQuestion": null
}
```

`destinationRefs` hanya diterima bila cocok dengan katalog (kecocokan nama/slug di sisi kode; model boleh mengusulkan, kode memutuskan). Nilai di luar enum ditolak dan permintaan diulang sekali, lalu jatuh ke `clarify`.

### 4.2 Mesin kode

- Memanggil logika yang sudah ada (skor per slot, alternatif, fasilitas). Tidak ada perhitungan skor baru.
- Tambahan data kecil (bagian 7): atribut destinasi dan waktu matahari terbit/terbenam.
- Perkiraan jarak antar destinasi: jarak garis lurus × 1,4 dibagi 30 km/jam, **diberi label "perkiraan"**.

### 4.3 Pertanyaan cepat tanpa model

Chip di panel ("Besok pagi ke mana?", "Rencana 1 hari", "Kalau hujan?") memanggil mesin langsung dengan parameter tetap. Fungsi inti tetap hidup bila model gagal, dan ini cadangan saat demo.

### 4.4 Konteks percakapan

Server tanpa status. Klien mengirim maksimal 6 giliran terakhir. Setiap respons membawa `focus` (daftar slug dan slot yang baru ditampilkan) supaya pertanyaan lanjutan bisa dirujuk. Panjang tiap pesan pengguna maksimal 500 karakter, total konteks dibatasi.

### 4.5 Penjelasan (panggilan #2)

Model menerima hanya fakta terpilih (nama, skor, label, alasan, suhu, jam, catatan jarak). Diminta menulis 2–4 kalimat Indonesia, dilarang menambah fakta. Hasil dilewatkan validator; bila gagal dipakai templat bawaan per intent.

## 5. Penyusun rencana (deterministik)

### 5.1 Masukan dan jendela slot

Hari target dan jendela default: pagi 08.00–11.00, siang 12.00–15.00, sore 15.00–18.00. Setiap jendela dipetakan ke slot grid sistem lewat `bestOverlappingSlot`; jam di label hanyalah tampilan.

### 5.2 Aturan (asumsi yang harus dicatat di proposal)

1. Destinasi harus **buka** pada slot dan skor ≥ 50 (ambang "layak").
2. Tiap destinasi dipakai sekali; usahakan campuran kategori.
3. Perkiraan waktu tempuh antar slot berurutan ≤ 60 menit; bila terlampaui, cari kandidat lain, dan bila tidak ada beri catatan "jauh".
4. Slot siang: prioritaskan `indoor`/teduh bila suhu prakiraan ≥ 32 °C (ambang adalah asumsi).
5. Slot sore: prioritaskan destinasi bertanda spot senja bila waktu matahari terbenam jatuh dalam slot (dihitung, bagian 7).
6. Hujan di slot: tukar dengan alternatif indoor yang sudah ada.
7. Destinasi dengan peringatan dini aktif dikeluarkan.
8. Pemilihan = penelusuran sederhana (maksimalkan jumlah skor dengan batasan di atas). 20 destinasi × 3 slot cukup kecil untuk dicoba semua kombinasi; hasilnya deterministik dan teruji.

### 5.3 Ubah satu slot

Menghitung ulang hanya slot itu dengan destinasi lain dipertahankan.

## 6. Validator dan keamanan

| Lapisan | Aturan |
| --- | --- |
| Masukan | Maks 500 karakter, tolak kosong, bersihkan karakter kontrol; teks pengguna selalu dibungkus sebagai data, bukan instruksi |
| Skema | Keluaran model divalidasi Zod; di luar skema = diulang sekali lalu templat |
| Slug | Setiap slug harus ada di katalog dan sesuai `destinationRefs`/hasil mesin |
| Angka | Semua angka di teks model harus ada di himpunan fakta (skor, suhu, jam, jarak); bila tidak, pakai templat |
| Topik | `out_of_scope` ditangani tanpa memanggil panggilan #2 |
| Injeksi | Instruksi sistem di sisi server; panggilan #1 tidak melihat data; keluaran tidak pernah dieksekusi atau dijadikan URL |
| Bahasa | Hanya Bahasa Indonesia; bahasa lain dijawab dengan templat singkat |
| Penyimpanan | Teks percakapan **tidak disimpan**. Log hanya metadata (intent, latensi, hasil validasi, galat) |
| Rahasia | Kunci API hanya di variabel lingkungan server, bukan `NEXT_PUBLIC_*`; CSP tidak berubah karena panggilan dari server |

### 6.1 Biaya dan kuota

- Batas per IP (tamu) dan per pengguna (login), memakai pola `rate_limit_hit` yang ada. Angka awal: tamu 20 pertanyaan/jam, login 60/jam.
- Batas harian global (`AI_DAILY_LIMIT`) sebagai pemutus: saat tercapai, mesin tanpa model tetap jalan dan banner menjelaskan.
- Batas waktu panggilan model 15 detik; satu percobaan ulang.
- Nama model dan kunci lewat variabel lingkungan (`AI_MODEL`, `AI_API_KEY`). **Verifikasi identifier model di dokumentasi penyedia sebelum mengunci**, karena model lama bisa dihentikan.

## 7. Data tambahan yang dibutuhkan

| Data | Sumber | Catatan |
| --- | --- | --- |
| `attributes` (jsonb) per destinasi: `teduh`, `ramah_anak`, `aksesibel`, `spot_senja`, `durasi_menit` | Pengisian manual 20 destinasi + penanda `verified_at` | Nilai kosong = "belum terdata". Tidak boleh ditebak model |
| Matahari terbit/terbenam | Perhitungan astronomi dari koordinat (tanpa API) | Fungsi murni + tes dengan nilai acuan |
| Harga tiket | **Tidak dimasukkan** sampai ada data terverifikasi | Draf awal menyebutnya, tetapi sistem belum menyimpannya |

Atribut subjektif ("sejuk di kaki Merapi") boleh dipakai di teks hanya bila tercatat di `attributes`.

## 8. Rencana tamu dan simpan ke rencana

- **Tamu:** rencana tetap ditampilkan penuh dan disimpan sementara di `sessionStorage`. Tombol "Masuk / Daftar untuk simpan" menuju `/masuk?next=<halaman>` (`next` harus lolos `safeNext`). Setelah kembali, rencana dipulihkan dan pengguna cukup menekan simpan.
- **Login:** tombol "Simpan ke Rencana Saya" memanggil server action. Aksi ini **tidak mempercayai isi dari klien**: menerima daftar `{slug, validAt}`, memvalidasi ulang (slug ada, slot dalam rentang prakiraan, judul dibersihkan dan dipotong), lalu memakai fungsi `createTrip` dan penambahan item yang sudah ada (batas 50 rencana/30 item dan rate limit tetap berlaku).
- Galat batas ditampilkan ramah ("rencanamu sudah penuh"), bukan galat mentah.
- Notifikasi sukses beserta tautan ke `/rencana`.

## 9. Antarmuka

- Tombol melayang di beranda dan halaman destinasi membuka panel. Isi: chip pertanyaan cepat, riwayat percakapan, kartu destinasi (skor memakai `ScoreChip`), kartu rencana, label "Dijawab AI. Skor tetap dari prakiraan BMKG."
- Kartu destinasi punya tautan ke halaman destinasi; "Sorot di peta" memakai `selectedSlug` yang sudah ada di beranda (di halaman destinasi diganti tautan).
- Aksesibilitas: dapat dioperasikan dengan keyboard, fokus berpindah ke panel dan kembali, area jawaban `aria-live="polite"`, target sentuh ≥ 44 px, tampil benar di mode terang dan gelap.
- Status: indikator "sedang berpikir", batas waktu, tombol coba lagi, pesan jelas bila kuota habis atau model gagal.
- Tanpa streaming pada versi pertama (respons JSON utuh; lebih sederhana untuk validasi).
- Halaman Tentang Data ditambah: data apa yang dikirim ke penyedia model (hanya teks pertanyaan), bahwa percakapan tidak disimpan, dan batas AI.

## 10. Pengujian

1. **Unit (tanpa model):** penyusun rencana (aturan 5.2, satu per aturan), pemetaan slot, perhitungan matahari, validator angka/slug, pembersih judul.
2. **Integrasi:** endpoint dengan model diganti tiruan: tiap intent, rate limit, kuota habis, galat model, keluaran model rusak, injeksi, simpan ke rencana dengan masukan jahat (slug palsu, slot kedaluwarsa, judul panjang).
3. **Set uji emas (30+ pertanyaan)** dengan perilaku yang diharapkan, dijalankan ke model sungguhan secara manual sebelum rilis. Wajib memuat:
   - Tiga skenario kunci (balita siang hari, Parangtritis vs Glagah, rencana 1 hari).
   - Waktu ambigu, di luar 3 hari, "sekarang", destinasi di luar katalog, keselamatan pantai, harga tiket.
   - Peringatan dini aktif, rencana multi-hari, ubah slot, pertanyaan lanjutan.
   - Injeksi, di luar topik, bahasa lain, input kosong/terlalu panjang.
4. Aksesibilitas: periksa dengan keyboard dan pembaca layar; Lighthouse pada halaman dengan panel terbuka.

## 11. Jadwal (sisa waktu hingga 30 Okt)

Deploy ke Supabase/Vercel **berjalan paralel** karena kunci AI harus di lingkungan produksi dan QA tanggal 24 Okt butuh URL.

| Hari | Pekerjaan | Selesai bila |
| --- | --- | --- |
| 1 | `attributes` + isi data, fungsi matahari, penyusun rencana + tes | Rencana deterministik lulus tes |
| 2 | Pemahaman + penjelasan model, validator, templat cadangan | Semua intent lulus dengan model tiruan |
| 3 | Endpoint, rate limit, batas harian, simpan ke rencana, sessionStorage tamu | Tes integrasi hijau |
| 4 | Panel UI, chip cepat, aksesibilitas, mode gelap | Alur ujung ke ujung di browser |
| 5 | Set uji emas ke model sungguhan, perbaikan, halaman Tentang Data | Set uji lulus, dokumen diperbarui |

Fitur dibekukan sekitar 21–22 Okt. Sisa waktu untuk QA, uji pengguna 25–26 Okt, dan proposal.

## 12. Risiko

| Risiko | Mitigasi |
| --- | --- |
| Kuota/biaya melonjak | Rate limit, batas harian, mesin tanpa model sebagai cadangan |
| Model mengarang | Kode memilih, validator angka dan slug, templat bawaan |
| Data atribut kosong atau salah | Hanya dipakai bila terisi dan bertanda verifikasi |
| Demo gagal karena jaringan/model | Chip cepat memakai mesin kode; rekam demo cadangan |
| Dianggap melanggar PRD | Catat di proposal sebagai tambahan di luar MVP dengan alasan dan batasnya |
| Tanggung jawab keselamatan (pantai) | Tidak pernah menyatakan aman/tidak aman; arahkan ke imbauan resmi |

## 13. Keputusan yang masih perlu diambil

1. **Penyedia dan model** (kunci API milik siapa, paket gratis atau berbayar, nama model terverifikasi).
2. **Siapa mengisi `attributes`** untuk 20 destinasi, dan sumbernya (situs resmi/Instagram pengelola).
3. **Batas angka** (tamu 20/jam, login 60/jam, batas harian) sesuai kuota yang tersedia.
4. **Perlu rencana multi-hari di versi pertama?** Rekomendasi: tidak; mulai 1 hari.
