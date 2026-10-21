---
version: 0.2   # 22 Okt 2026: token dan spesifikasi status kondisi laut, catatan mode gelap
name: JelajahLokal-design
description: Sistem desain JelajahLokal untuk Web Development Competition UINIC 8.0. Kerangka hangat-editorial (latar krem, judul serif bobot 400, skala radius dan spasi 4px) diturunkan dari analisis DESIGN.md Claude.com, tetapi identitasnya diganti dengan palet batik klasik Yogyakarta (krem, soga, nila), font berlisensi terbuka, dan komponen khusus aplikasi peta wisata. Semua pasangan warna teks lulus WCAG 2.2 AA.

colors:
  # Merek dan permukaan
  canvas: "#faf9f5"
  surface-soft: "#f5f0e8"
  surface-card: "#efe9de"
  surface-card-strong: "#e8e0d2"
  surface-dark: "#1e2b45"          # nila
  surface-dark-elevated: "#2a3a5a"
  primary: "#9a4f2c"               # soga
  primary-active: "#7a3d22"
  primary-disabled: "#e6dfd8"
  on-primary: "#ffffff"
  on-dark: "#faf9f5"
  on-dark-soft: "#c9cdd6"
  # Teks
  ink: "#141413"
  body: "#3d3d3a"
  muted: "#66635c"
  # Garis
  border-input: "#8f877b"
  hairline: "#e6dfd8"              # dekoratif saja, bukan batas komponen
  focus: "#1e2b45"
  # Status skor kelayakan (selalu sebagai chip berlatar muda)
  score-good-text: "#1a6b4f"
  score-good-bg: "#dcefe6"
  score-mid-text: "#8a5a00"
  score-mid-bg: "#f6e7c8"
  score-bad-text: "#b3261e"
  score-bad-bg: "#f7dcd8"
  score-closed-text: "#66635c"
  score-closed-bg: "#efe9de"
  # Banner
  banner-stale-text: "#8a5a00"
  banner-stale-bg: "#f6e7c8"
  banner-alert-text: "#b3261e"
  banner-alert-bg: "#f7dcd8"
  # Status kondisi laut (badge persegi berikon ombak; nilai mode terang)
  sea-info-text: "#1e2b45"
  sea-info-bg: "#e4e9f2"
  sea-caution-text: "#8a5a00"
  sea-caution-bg: "#f6e7c8"
  sea-danger-text: "#b3261e"
  sea-danger-bg: "#f7dcd8"
  sea-unknown-text: "#66635c"
  sea-unknown-bg: "#efe9de"

typography:
  display-lg:
    fontFamily: "Fraunces, 'Source Serif 4', Georgia, serif"
    fontSize: 40px            # desktop; 28px di ponsel
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: -0.5px
  display-md:
    fontFamily: "Fraunces, 'Source Serif 4', Georgia, serif"
    fontSize: 28px            # desktop; 22px di ponsel
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: -0.3px
  title-md:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: 18px            # 17px di ponsel
    fontWeight: 600
    lineHeight: 1.35
  body-md:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.3
  button:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1
  caption:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  score-number:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 700
    fontVariantNumeric: tabular-nums
  code:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6

rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px               # hanya halaman pembuka atau landing

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 12px 20px
    minHeight: 44px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.border-input}"
    rounded: "{rounded.md}"
    minHeight: 44px
  button-icon:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.border-input}"
    rounded: "{rounded.pill}"
    size: 44px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.border-input}"
    rounded: "{rounded.md}"
    minHeight: 44px
  focus-ring:
    outline: "2px solid {colors.focus}"
    outlineOffset: 2px
  category-filter-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.border-input}"
    rounded: "{rounded.pill}"
    minHeight: 40px
  category-filter-chip-selected:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
  score-chip-good:
    backgroundColor: "{colors.score-good-bg}"
    textColor: "{colors.score-good-text}"
    icon: circle-check
    rounded: "{rounded.pill}"
    padding: 4px 10px
  score-chip-mid:
    backgroundColor: "{colors.score-mid-bg}"
    textColor: "{colors.score-mid-text}"
    icon: circle-half
  score-chip-bad:
    backgroundColor: "{colors.score-bad-bg}"
    textColor: "{colors.score-bad-text}"
    icon: triangle-alert
  score-chip-closed:
    backgroundColor: "{colors.score-closed-bg}"
    textColor: "{colors.score-closed-text}"
    icon: lock
  slot-cell:
    backgroundColor: "{colors.canvas}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    width: 88px
    padding: 12px 8px
  slot-cell-selected:
    border: "2px solid {colors.surface-dark}"
  destination-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 16px
  alternative-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 16px
    borderLeft: "4px solid {colors.surface-dark}"
  facility-row:
    backgroundColor: transparent
    textColor: "{colors.body}"
    minHeight: 48px
    divider: "1px solid {colors.hairline}"
  map-pin:
    fill: "score color text token (good/mid/bad/closed)"
    ring: "2px solid #ffffff"
    glyph: "ikon kategori, putih"
    size: 32px
  map-pin-selected:
    size: 40px
    shadow: "0 2px 6px rgba(20,20,19,0.25)"
  bottom-sheet:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl} {rounded.xl} 0 0"
    shadow: "0 -2px 12px rgba(20,20,19,0.12)"
    handle: "36x4px, {colors.border-input}"
  banner-stale:
    backgroundColor: "{colors.banner-stale-bg}"
    textColor: "{colors.banner-stale-text}"
    icon: clock-alert
    rounded: "{rounded.md}"
  banner-alert:
    backgroundColor: "{colors.banner-alert-bg}"
    textColor: "{colors.banner-alert-text}"
    icon: cloud-lightning
    rounded: "{rounded.md}"
  attribution-bar:
    backgroundColor: transparent
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
  footer:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark-soft}"
---

# Sistem Desain JelajahLokal

## Ringkasan

JelajahLokal memakai kerangka hangat-editorial, yaitu latar krem, judul serif bobot 400 dengan tracking negatif, dan sans humanis untuk teks. Identitasnya diambil dari palet batik klasik Yogyakarta, yaitu krem sebagai latar, coklat soga sebagai warna aksi, dan biru nila sebagai permukaan gelap. Arah ini sekaligus menguatkan subtema Sosial Budaya.

Klaim bahwa krem, soga, dan nila adalah palet batik klasik Yogyakarta **perlu dicek ke sumber budaya** sebelum ditulis di proposal.

Sistem ini sengaja tidak meniru identitas Claude.com. Coral #cc785c, font Copernicus dan StyreneB, serta logo spike-mark tidak dipakai, karena ketiganya aset merek Anthropic dan font-nya berlisensi tertutup.

## Warna

Semua rasio dihitung dengan rumus kontras WCAG 2.2. Batas lulus AA adalah 4,5 untuk teks biasa dan 3,0 untuk batas komponen serta teks besar.

### Merek, permukaan, dan teks

| Token | Hex | Kontras | Pemakaian |
| --- | --- | --- | --- |
| `canvas` | #faf9f5 | - | Latar utama semua halaman |
| `surface-card` | #efe9de | - | Kartu destinasi, kartu alternatif |
| `surface-dark` (nila) | #1e2b45 | 13,41 dengan `on-dark` | Footer, filter terpilih, header bottom sheet |
| `primary` (soga) | #9a4f2c | 5,95 dengan teks putih | Tombol utama ("Simpan ke rencana", "Buka rute") |
| `primary-active` | #7a3d22 | 8,34 dengan teks putih | Tombol utama saat ditekan |
| Tautan (`primary`) | #9a4f2c | 5,65 di `canvas`, 4,93 di `surface-card` | Tautan dalam teks, bergaris bawah |
| `ink` | #141413 | - | Judul dan teks utama |
| `body` | #3d3d3a | 10,34 di `canvas` | Paragraf |
| `muted` | #66635c | 5,69 di `canvas`, 4,96 di `surface-card` | Teks sekunder, waktu data |
| `border-input` | #8f877b | 3,37 di `canvas` | Batas input, tombol sekunder, chip filter |
| `hairline` | #e6dfd8 | 1,25 | Pemisah dekoratif saja |
| `focus` | #1e2b45 | 13,41 | Cincin fokus |

### Status skor kelayakan

Status skor **selalu** tampil sebagai chip berlatar muda dengan ikon dan teks. Jangan pernah memakainya sebagai blok solid, supaya merah "Kurang sesuai" tidak tertukar dengan tombol soga yang juga bernada hangat.

| Status | Rentang skor | Teks | Latar | Kontras | Ikon |
| --- | --- | --- | --- | --- | --- |
| Sangat sesuai | 75 sampai 100 | #1a6b4f | #dcefe6 | 5,38 | Lingkaran centang |
| Cukup sesuai | 50 sampai 74 | #8a5a00 | #f6e7c8 | 4,85 | Setengah lingkaran |
| Kurang sesuai | 0 sampai 49 | #b3261e | #f7dcd8 | 5,04 | Segitiga tanda seru |
| Tutup | - | #66635c | #efe9de | 4,96 | Gembok |

Bentuk ikon yang berbeda membuat status tetap terbaca oleh pengguna buta warna dan saat dicetak hitam putih.

### Status kondisi laut

Status laut (prakiraan maritim BMKG untuk pantai) adalah indikator **terpisah** dari skor kelayakan, jadi sengaja **tidak memakai chip skor**: bentuknya persegi bersudut tipis (bukan pill), berikon ombak, dan tanpa varian hijau, supaya tidak terbaca sebagai "nilai baik". Teks badge berasal dari satu sumber, `src/lib/marine/sea-labels.ts`; token warnanya `--color-sea-*` di `src/app/globals.css`.

| Status | Kategori BMKG | Contoh teks badge | Terang: teks / latar (kontras) | Gelap: teks / latar (kontras) |
| --- | --- | --- | --- | --- |
| Perhatian | Tenang, Rendah | Gelombang rendah · 1,1 m | #1e2b45 / #e4e9f2 (11,59) | #a9bce0 / #1c2638 (7,92) |
| Waspada | Sedang | Waspada · gelombang sedang 1,9 m | #8a5a00 / #f6e7c8 (4,85) | #fbbf24 / #362a12 (8,40) |
| Bahaya | Tinggi ke atas | Bahaya · gelombang tinggi 2,6 m | #b3261e / #f7dcd8 (5,04) | #f87171 / #381615 (5,87) |
| Informasi terbatas | Tidak ada data, atau data lebih dari 24 jam | Data laut belum tersedia | #66635c / #efe9de (4,96) | #9ca3af / #262626 (5,96) |

Semua pasangan lulus AA (4,5). Kontras dihitung dengan rumus WCAG 2.2 pada 22 Okt 2026. Aturan isi: kata "aman" **tidak pernah** dipakai untuk kondisi laut; status terendah adalah "Perhatian"; hanya Waspada dan Bahaya memakai kata perintah.

### Warna dari DESIGN.md yang tidak dipakai

| Warna asli | Masalah |
| --- | --- |
| Coral #cc785c dengan teks putih | 3,28, gagal untuk teks 14px |
| Coral sebagai tautan di krem | 3,11, gagal |
| `success` #5db872 sebagai teks | 2,33, gagal |
| `warning` #d4a017 sebagai teks | 2,25, gagal |
| `accent-teal` #5db8a6 sebagai teks | 2,25, gagal |
| `muted-soft` #8e8b82 di krem | 3,23, gagal untuk teks biasa |

## Tipografi

| Peran | Font | Ponsel | Desktop | Bobot |
| --- | --- | --- | --- | --- |
| Judul halaman | Fraunces (cadangan Source Serif 4) | 28px | 40px | 400, tracking -0,5px |
| Judul bagian | Fraunces | 22px | 28px | 400, tracking -0,3px |
| Judul kartu | Plus Jakarta Sans | 17px | 18px | 600 |
| Teks isi | Plus Jakarta Sans | 16px | 16px | 400, line-height 1,55 |
| Label dan chip | Plus Jakarta Sans | 14px | 14px | 500 |
| Tombol | Plus Jakarta Sans | 15px | 15px | 600 |
| Keterangan dan atribusi | Plus Jakarta Sans | 13px | 13px | 400, warna `muted` |
| Angka skor | Plus Jakarta Sans | 14px | 14px | 700, `tabular-nums` |

Ketiga font tersedia gratis dengan lisensi terbuka di Google Fonts. Plus Jakarta Sans setahu tim dirancang desainer Indonesia untuk identitas kota Jakarta. Klaim ini **perlu dicek** sebelum dipakai sebagai argumen lokalitas di proposal.

Aturan tipografi:

- Serif hanya untuk judul halaman dan judul bagian, selalu bobot 400.
- Teks isi minimal 16px supaya input di iOS tidak memicu zoom otomatis.
- Angka skor dan jarak memakai `tabular-nums` agar sejajar di daftar.

## Spasi, bentuk, dan kedalaman

- **Grid dasar 4px.** Token 4, 8, 12, 16, 24, 32, 48.
- **Jarak antar-bagian di layar aplikasi** 24 sampai 32px. Jarak 96px hanya untuk halaman pembuka.
- **Radius.** 8px untuk tombol dan input, 12px untuk kartu, 16px untuk sudut atas bottom sheet, pill untuk chip.
- **Kedalaman.** Utamakan perbedaan warna permukaan. Bayangan hanya untuk bottom sheet dan pin peta yang sedang dipilih.
- **Lebar konten desktop** maksimal 1200px. Halaman detail di desktop memakai dua kolom, info di kiri dan peta di kanan.

## Komponen khusus JelajahLokal

### Chip skor

Bentuk pill berisi ikon, angka skor, dan label, misalnya ikon centang, "82", "Sangat sesuai". Di ruang sempit (sel slot), label boleh disingkat menjadi angka dan ikon saja, tetapi `aria-label` tetap memuat label lengkap.

### Badge status laut

Padanan chip skor untuk kondisi laut pada destinasi pantai: persegi bersudut tipis dengan garis tepi tipis sewarna teks, ikon ombak (3 gelombang) di kiri, lalu teks dari `sea-labels.ts`, misalnya "Waspada · gelombang sedang 1,9 m". Tampil di kartu daftar, tooltip peta, dan halaman detail. Ukuran `sm` (11px) untuk ruang sempit, `md` (12,5px) selebihnya. `aria-label` memuat status, kategori, tinggi, dan kalimat pendamping (mis. "Jangan bermain air."), `title` memuat hal yang sama. Detail aturan warna ada di "Status kondisi laut" di atas.

### Strip slot 3 jam

Satu baris yang bisa digulir horizontal dengan `scroll-snap`. Setiap sel berisi jam (WIB), ikon cuaca, suhu, dan chip skor ringkas. Sel terpilih diberi garis tepi nila 2px. Sel di luar jam buka memakai chip "Tutup". Strip ditandai sebagai `role="listbox"` dan setiap sel sebagai `role="option"` agar bisa dipilih dengan tombol panah.

### Pin peta

Lingkaran 32px dengan ikon kategori putih di dalamnya. Warna isi memakai warna teks status sesuai skor slot terbaik pada hari yang dipilih. Cincin putih 2px menjaga kontras terhadap peta dasar. Pin terpilih membesar menjadi 40px dengan bayangan.

| Kategori | Ikon yang disarankan |
| --- | --- |
| Pantai | Ombak |
| Alam | Gunung |
| Budaya | Candi atau gapura |
| Museum | Gedung berpilar |
| Desa wisata | Rumah |

### Bottom sheet (ponsel)

Di Beranda, peta mengisi layar dan daftar destinasi berada di bottom sheet dengan tiga posisi, yaitu terlipat (hanya pegangan dan jumlah hasil), setengah, dan penuh. Daftar di bottom sheet adalah padanan non-peta yang diwajibkan PRD, jadi semua informasi di peta juga harus ada di sana.

### Kartu alternatif

Kartu berlatar `surface-card` dengan garis kiri nila 4px dan judul "Kalau hujan, coba ini". Berisi maksimal 3 destinasi indoor dengan jarak dan chip skor pada slot yang sama.

### Baris fasilitas

Tinggi minimal 48px, berisi ikon tipe, nama (atau "Tanpa nama" bila kosong di OSM), dan jarak di kanan. Dikelompokkan per tipe dengan judul kecil. Jika satu tipe kosong, tampilkan "Belum terpetakan di OpenStreetMap".

### Banner status

- **Data belum diperbarui.** Warna amber, ikon jam, selalu menyebut waktu data terakhir.
- **Peringatan dini BMKG.** Warna merah, ikon awan petir, menyebut jenis kejadian dan masa berlaku.

Banner berada di bawah judul destinasi dan tidak bisa ditutup selama kondisinya masih berlaku.

### Atribusi

Baris kecil berwarna `muted` di bawah peta dan di bagian bawah halaman detail. Isinya "Data cuaca BMKG", "© OpenStreetMap contributors (ODbL)", dan "Peta OpenFreeMap". Jangan disembunyikan di balik tombol atau menu.

### Fokus dan state

- Semua elemen interaktif punya `:focus-visible` dengan cincin nila 2px dan jarak 2px.
- Tombol utama punya state ditekan (`primary-active`) dan state nonaktif (`primary-disabled` dengan teks `muted`).
- Area sentuh minimal 44 × 44px.

## Wireframe halaman detail (ponsel, 360px)

```
┌──────────────────────────────────┐
│ ←  Pantai Parangtritis       ♡  │  header
│ Pantai · Bantul                  │  caption muted
├──────────────────────────────────┤
│ ⚠ Data belum diperbarui (06.00)  │  banner-stale (bila ada)
├──────────────────────────────────┤
│ Waktu terbaik besok              │  display-md (serif)
│ ✓ 82  Sangat sesuai · 09.00      │  chip skor besar
│                                  │
│ [Hari ini] [Besok] [Lusa]        │  tab hari
│ ┌────┐┌────┐┌────┐┌────┐┌────┐→  │  strip slot 3 jam
│ │06  ││09  ││12  ││15  ││18  │   │
│ │Bw26││Bw28││Cr31││Hj29││Bw27│   │
│ │✓ 90││✓ 82││◐ 61││▲ 25││Ttp │   │
│ └────┘└────┘└────┘└────┘└────┘   │
│                                  │
│ Kenapa 15.00 kurang sesuai?      │  title-md
│ · Hujan ringan diprakirakan (-40)│
│ · Angin 25 km/jam (-27)          │
├──────────────────────────────────┤
│ Kalau hujan, coba ini            │  alternative-card
│ ▌Museum ... · 4,2 km · ✓ 95      │
│ ▌Museum ... · 6,8 km · ✓ 95      │
├──────────────────────────────────┤
│ Fasilitas dalam 1 km  [500][1k][2k] │
│ [peta kecil]                     │
│ Toilet     Toilet umum    120 m  │  facility-row
│ Parkir     Parkir pantai  210 m  │
│ Makan      Warung ...     340 m  │
├──────────────────────────────────┤
│ Akses                            │
│ Halte terdekat ...       1,4 km  │
│ [      Buka rute      ]          │  button-primary (soga)
│ [ Simpan ke rencana ]            │  button-secondary
├──────────────────────────────────┤
│ Data cuaca BMKG · © OpenStreetMap│  attribution-bar
│ contributors (ODbL) · OpenFreeMap│
└──────────────────────────────────┘
```

Angka dan nama di wireframe adalah ilustrasi tata letak, bukan data nyata. Singkatan di strip slot (Bw berawan, Cr cerah, Hj hujan, Ttp tutup) hanya untuk wireframe teks ini. Di aplikasi, singkatan itu diganti ikon cuaca.

## Peta dasar

Gunakan style Positron dari OpenFreeMap sebagai titik awal, lalu ubah JSON style MapLibre-nya supaya warna daratan mendekati `canvas` dan air bernada nila pucat. Hasilnya **perlu dicoba dulu**, karena belum diverifikasi. Simpan URL style di variabel konfigurasi, jangan ditulis langsung di kode, supaya mudah diganti bila layanan bermasalah.

## Responsif

| Lebar | Perubahan utama |
| --- | --- |
| Di bawah 768px | Peta penuh layar dengan bottom sheet, detail satu kolom, judul 28px |
| 768 sampai 1024px | Daftar di panel kiri 360px, peta di kanan |
| Di atas 1024px | Detail dua kolom (info kiri, peta dan fasilitas kanan), judul 40px |

Strip slot tetap digulir horizontal di semua lebar, tidak dibungkus menjadi beberapa baris.

## Mode gelap

Aplikasi punya mode gelap (tombol di header; bila belum dipilih, mengikuti preferensi sistem). Nilai tiap token untuk mode gelap ada di `src/app/globals.css` (blok `.dark`), **bukan** di front matter di atas, yang hanya mencatat mode terang. Dokumen ini baru mencatat nilai dan kontras mode gelap untuk token status laut; kontras seluruh palet gelap lainnya belum diaudit di sini.

## Boleh dan jangan

**Boleh**

- Pakai `canvas` krem sebagai latar di semua halaman.
- Pakai soga hanya untuk satu aksi utama per layar.
- Tampilkan alasan di setiap skor yang tidak "Sangat sesuai".
- Tampilkan waktu data di setiap tempat yang memakai prakiraan.

**Jangan**

- Jangan memakai warna status sebagai blok solid atau sebagai warna tombol.
- Jangan membedakan status hanya dengan warna.
- Jangan memakai `hairline` sebagai batas input atau tombol.
- Jangan memakai coral #cc785c, font Copernicus atau StyreneB, atau logo spike-mark Anthropic.
- Jangan menebalkan judul serif. Untuk penekanan, perbesar ukurannya.

## Perubahan dari DESIGN.md asli

| Aturan asli | Diganti menjadi | Alasan |
| --- | --- | --- |
| Coral #cc785c sebagai warna aksi | Soga #9a4f2c | Coral 3,28 dengan teks putih, gagal AA |
| Batas input `hairline` | `border-input` #8f877b | Hairline 1,25, batas input tidak terlihat |
| Tidak boleh ada warna keempat | Empat warna status khusus skor | Skor butuh status yang jelas berbeda |
| Hover dan state lain tidak didokumentasikan | Wajib `:focus-visible` dan state ditekan | PRD mewajibkan navigasi keyboard |
| Tombol ikon 36px | Minimal 44 × 44px | Dipakai di ponsel |
| Jarak antar-bagian 96px | 24 sampai 32px di layar aplikasi | Layar ponsel terbatas |
| Permukaan gelap #181715 | Nila #1e2b45 | Identitas lokal |
| Copernicus, StyreneB, spike-mark | Fraunces, Plus Jakarta Sans, logo sendiri | Aset merek dan font berlisensi |

## Yang perlu diverifikasi

- [ ] Palet krem, soga, dan nila sebagai warna batik klasik Yogyakarta, dari sumber budaya yang bisa dikutip.
- [ ] Asal-usul Plus Jakarta Sans sebelum dipakai sebagai argumen lokalitas.
- [ ] Hasil kustomisasi style OpenFreeMap Positron dengan warna krem dan nila.
- [ ] Kontras pin peta terhadap peta dasar setelah style dikustomisasi (minimal 3:1).
- [ ] Skor Lighthouse Accessibility minimal 90 setelah halaman dibangun.
- [ ] Kontras seluruh pasangan warna mode gelap (baru token status laut yang tercatat di dokumen ini).
