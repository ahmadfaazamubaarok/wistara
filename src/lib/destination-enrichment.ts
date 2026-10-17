// Data pengayaan destinasi wisata Wistara (non-breaking, layer informasi praktis).
// Berisi informasi tiket masuk (HTM), parkir, tips berkunjung, highlight aktivitas, dan tag minat.

export type DestinationEnrichment = {
  ticketPrice: {
    domestic: string;
    international?: string;
    parking?: string;
  };
  highlights: string[];
  tips: string[];
  tags: string[];
  bestTimeNote?: string;
};

const ENRICHMENT_DATA: Record<string, DestinationEnrichment> = {
  "pantai-parangtritis": {
    ticketPrice: {
      domestic: "Rp 10.000 / orang (Retribusi TPR)",
      parking: "Motor Rp 3.000, Mobil Rp 10.000",
    },
    highlights: [
      "Pemandangan matahari terbenam (sunset) samudra Hindia yang luas",
      "Wahana bendi keliling pantai dan persewaan ATV di pesisir",
      "Pusat kuliner laut segar dan pasar oleh-oleh khas pesisir",
    ],
    tips: [
      "Patuhi peringatan petugas dan hindari berenang ke tengah laut karena terdapat palung berbahaya (rip current).",
      "Waktu terbaik berkunjung adalah sore hari pukul 16:30–18:00 WIB untuk menikmati panorama senja.",
      "Gunakan kacamata hitam dan pakaian santai untuk kenyamanan di tepi pantai berpasir.",
    ],
    tags: ["Sunset", "Pantai Populer", "Spot Foto", "Keluarga", "Pasir Hitam"],
    bestTimeNote: "Sore hari pukul 16:30–18:00 WIB",
  },
  "pantai-indrayanti": {
    ticketPrice: {
      domestic: "Rp 10.000 (Retribusi Terpadu Gunungkidul)",
      parking: "Motor Rp 5.000, Mobil Rp 10.000",
    },
    highlights: [
      "Hamparan pasir putih bersih yang dipagari tebing karang alami",
      "Deretan gazebo dan payung santai tepi laut",
      "Restoran seafood dan kafe dengan pemandangan langsung ke ombak",
    ],
    tips: [
      "Jaga kebersihan area pantai; pengelola memberlakukan denda bagi pembuang sampah sembarangan.",
      "Siapkan uang tunai yang cukup karena jangkauan sinyal data dan mesin ATM terbatas di lokasi.",
      "Gunakan alas kaki yang nyaman untuk berjalan di atas bebatuan dan pasir putih.",
    ],
    tags: ["Pasir Putih", "Kuliner Laut", "Spot Foto", "Santai", "Pantai Karang"],
    bestTimeNote: "Pagi hari 07:00–10:00 atau sore hari 15:30–17:30 WIB",
  },
  "pantai-baron": {
    ticketPrice: {
      domestic: "Rp 10.000 (Retribusi Terpadu Gunungkidul)",
      parking: "Motor Rp 3.000, Mobil Rp 10.000",
    },
    highlights: [
      "Fenomena unik muara sungai bawah tanah air tawar yang bertemu langsung dengan air laut",
      "Pasar pelelangan ikan segar langsung dari perahu nelayan lokal",
      "Menara mercusuar pengawas pantai yang gagah di atas bukit karang",
    ],
    tips: [
      "Wisatawan dapat membeli ikan segar langsung di pelelangan dan meminta warung makan sekitar untuk memasaknya.",
      "Area aliran air tawar yang tenang lebih aman untuk anak-anak bermain air dibanding ombak samudra.",
      "Waspadai ubur-ubur api pada bulan-bulan tertentu dengan ombak tenang di awal musim kemarau.",
    ],
    tags: ["Pasar Ikan", "Kuliner Seafood", "Muara Air Tawar", "Mercusuar", "Keluarga"],
    bestTimeNote: "Pagi hari saat nelayan merapat membawa hasil tangkapan segar",
  },
  "pantai-glagah": {
    ticketPrice: {
      domestic: "Rp 6.000 / orang",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Deretan pemecah ombak tetrapod beton ikonik yang membelah ombak besar",
      "Laguna air tenang yang ramah anak untuk naik perahu kayuh dan kano",
      "Lokasi dekat dengan Bandara Internasional Yogyakarta (YIA) untuk melihat pesawat mendarat",
    ],
    tips: [
      "Hati-hati saat berjalan di atas tetrapod pemecah ombak karena celah antar-beton cukup dalam.",
      "Area laguna sangat cocok untuk wisata santai keluarga tanpa perlu khawatir ombak pantai selatan.",
      "Spot siluet matahari terbenam dengan latar tetrapod merupakan favorit para fotografer.",
    ],
    tags: ["Pemecah Ombak", "Laguna", "Pesawat YIA", "Sunset", "Spot Foto"],
    bestTimeNote: "Sore hari menjelang matahari terbenam",
  },
  "gumuk-pasir-parangkusumo": {
    ticketPrice: {
      domestic: "Bebas tiket masuk (Sewa papan sandboarding Rp 70.000–100.000)",
      parking: "Motor Rp 3.000, Mobil Rp 10.000",
    },
    highlights: [
      "Fenomena bentang alam gumuk pasir tipe barchan langka di kawasan tropis Asia Tenggara",
      "Sensasi olahraga seluncur pasir (sandboarding) yang menantang",
      "Spot foto estetik dengan nuansa lanskap gurun pasir eksotis",
    ],
    tips: [
      "Hindari berkunjung tepat di siang hari karena suhu pasir sangat terik; disarankan pagi sebelum jam 09:00 atau sore jam 16:00.",
      "Kenakan kacamata pelindung agar mata tidak kemasukan partikel pasir halus saat tertiup angin kencang.",
      "Pakai pakaian berlengan panjang atau tabir surya untuk melindungi kulit dari sengatan matahari.",
    ],
    tags: ["Gurun Pasir", "Sandboarding", "Spot Foto Estetik", "Petualangan", "Sunset"],
    bestTimeNote: "Pukul 06:30–09:00 WIB atau 16:00–17:30 WIB",
  },
  "gunung-api-purba-nglanggeran": {
    ticketPrice: {
      domestic: "Rp 15.000 (Siang), Rp 20.000 (Malam / Camping)",
      international: "Rp 30.000",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Formasi batuan vulkanik raksasa berumur sekitar 60–70 juta tahun yang menakjubkan",
      "Jalur pendakian alami menyusuri celah dan lorong sempit batuan purba",
      "Panorama matahari terbit (sunrise) dan lautan kabut dari puncak gunung",
    ],
    tips: [
      "Kenakan sepatu olahraga atau sandal gunung dengan grip sol yang tidak licin.",
      "Bawa air minum minimal 1 liter untuk bekal selama trekking 45–60 menit ke puncak.",
      "Mulai mendaki pagi-pagi sekali sekitar pukul 05:00 WIB jika ingin menyaksikan pesona kabut fajar.",
    ],
    tags: ["Trekking", "Sunrise", "Geowisata", "Pemandangan Alam", "Petualangan"],
    bestTimeNote: "Pagi hari 05:00–08:00 WIB untuk trekking yang sejuk",
  },
  "hutan-pinus-mangunan": {
    ticketPrice: {
      domestic: "Rp 5.000 / orang",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Deretan pohon pinus menjulang tinggi dengan udara segar pegunungan yang menyejukkan",
      "Panggung teater kayu alami terbuka bergaya rustic di tengah hutan",
      "Spot hammock santai dan gardu pandang panorama lembah hijau",
    ],
    tips: [
      "Tempat ideal untuk piknik santai keluarga sambil membawa alas tikar dan makanan ringan.",
      "Di pagi hari sering turun kabut tipis yang menghasilkan efek cahaya berkas sinar (ray of light) memukau untuk foto.",
      "Tersedia fasilitas toilet, mushola, serta deretan warung kuliner tradisional di luar gerbang.",
    ],
    tags: ["Hutan Pinus", "Sejuk", "Spot Foto", "Piknik", "Keluarga"],
    bestTimeNote: "Pagi hari 07:00–10:00 WIB saat udara paling segar",
  },
  "kalibiru": {
    ticketPrice: {
      domestic: "Rp 10.000 (Tiket Masuk Utama)",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Gardu pandang pohon pinus ikonik berlatar keindahan air Waduk Sermo nan membiru",
      "Wahana uji adrenalin high rope, jembatan gantung, dan flying fox di atas lembah",
      "Pemandangan hamparan perbukitan Menoreh Kulon Progo yang asri",
    ],
    tips: [
      "Tersedia tiket tambahan opsional untuk spot foto di atas pohon yang dilengkapi tali pengaman resmi.",
      "Jalur jalan menuju Kalibiru cukup menanjak, pastikan kondisi rem dan mesin kendaraan prima.",
      "Waktu terbaik berkunjung saat langit cerah agar warna biru Waduk Sermo tampak berkilau.",
    ],
    tags: ["Gardu Pandang", "Waduk Sermo", "Bukit Menoreh", "Spot Foto", "Petualangan"],
    bestTimeNote: "Pagi hari atau sore sebelum kabut pegunungan turun",
  },
  "keraton-yogyakarta": {
    ticketPrice: {
      domestic: "Rp 15.000 (Dewasa), Rp 10.000 (Anak)",
      international: "Rp 25.000",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Pusat kebudayaan Jawa hidup yang menjadi kediaman resmi Sultan Hamengku Buwono",
      "Koleksi pusaka kerajaan, kereta kencana, pakaian adat, dan lukisan bersejarah Mataram",
      "Pertunjukan seni tari keraton, wayang golek, atau gamelan setiap hari pada jam tertentu",
    ],
    tips: [
      "Wajib mengenakan pakaian sopan dan bertutup pundak/lutut; dilarang memakai celana pendek dan baju tanpa lengan.",
      "Lepaskan topi atau pelindung kepala saat memasuki pelataran inti keraton sebagai bentuk penghormatan.",
      "Loket tiket tutup sekitar pukul 14:00 WIB, jadi disarankan datang di pagi hari.",
    ],
    tags: ["Sejarah", "Budaya Jawa", "Kerajaan", "Edukasi", "Spot Ikonik"],
    bestTimeNote: "Pagi hari 08:30–11:00 WIB",
  },
  "taman-sari": {
    ticketPrice: {
      domestic: "Rp 15.000 / orang",
      international: "Rp 25.000",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Kompleks kolam pemandian peristirahatan Sultan Umbul Pasiraman dengan air biru jernih",
      "Masjid bawah tanah Sumur Gumuling berarsitektur melingkar dengan tangga bertingkat megah",
      "Lorong bawah tanah kuno dan gapura gerbang berpahatkan ukiran Portugis-Jawa klasik",
    ],
    tips: [
      "Gunakan jasa pemandu lokal terdaftar di gerbang masuk agar mendapatkan cerita sejarah lorong bawah tanah secara mendalam.",
      "Datanglah lebih pagi menjelang jam buka untuk menghindari antrean foto di tangga Sumur Gumuling.",
      "Gunakan sepatu yang nyaman karena area jelajah melibatkan anak tangga dan permukaan berbatu.",
    ],
    tags: ["Arsitektur Kuno", "Lorong Bawah Tanah", "Sejarah", "Spot Foto Estetik", "Edukasi"],
    bestTimeNote: "Pagi hari 09:00–11:00 WIB sebelum ramai antrean",
  },
  "candi-prambanan": {
    ticketPrice: {
      domestic: "Rp 50.000 (Dewasa), Rp 25.000 (Anak)",
      international: "USD 25 / Rp 375.000",
      parking: "Motor Rp 5.000, Mobil Rp 15.000",
    },
    highlights: [
      "Candi Hindu tertinggi dan tercantik di Asia Tenggara (Situs Warisan Dunia UNESCO)",
      "Pahatan relief epos Ramayana dan Krishnayana yang detail di dinding candi Siwa dan Brahma",
      "Pentas legendaris Sendratari Ramayana (Ramayana Ballet) berlatar siluet candi di malam hari",
    ],
    tips: [
      "Bawa payung, topi lebar, dan tabir surya karena pelataran candi sangat luas dan terbuka terhadap sinar matahari.",
      "Dilarang memanjat batuan candi dan jagalah ketenangan di area suci candi peribadatan.",
      "Tersedia layanan sewa sepeda listrik dan mobil golf untuk mengelilingi taman kompleks candi yang luas.",
    ],
    tags: ["UNESCO Heritage", "Candi Megah", "Sejarah", "Ramayana Ballet", "Keluarga"],
    bestTimeNote: "Pagi hari 06:30–09:00 atau sore hari 15:30–17:00 WIB",
  },
  "candi-ratu-boko": {
    ticketPrice: {
      domestic: "Rp 40.000 (Dewasa), Rp 20.000 (Anak)",
      international: "USD 25 / Rp 375.000",
      parking: "Motor Rp 5.000, Mobil Rp 10.000",
    },
    highlights: [
      "Kemegahan gapura batu bertingkat peninggalan keraton Mataram kuno di atas bukit",
      "Panorama siluet matahari terbenam (sunset) terbaik di Yogyakarta dengan latar langit jingga",
      "Pemandangan lepas ke arah Candi Prambanan dan Gunung Merapi dari ketinggian bukit",
    ],
    tips: [
      "Momen emas (golden hour) berada di antara pukul 16:30–17:30 WIB; datanglah sebelum pukul 16:00 agar leluasa memilih posisi foto.",
      "Kawasan berbukit memerlukan jalan kaki menanjak ringan, gunakan sepatu yang nyaman.",
      "Tersedia paket tiket terusan Candi Prambanan & Ratu Boko dengan fasilitas antar-jemput shuttle gratis.",
    ],
    tags: ["Sunset Spektakuler", "Istana Kuno", "Pemandangan Bukit", "Spot Foto", "Sejarah"],
    bestTimeNote: "Sore hari 16:00–18:00 WIB untuk momen matahari terbenam",
  },
  "museum-benteng-vredeburg": {
    ticketPrice: {
      domestic: "Rp 10.000 (Dewasa), Rp 5.000 (Anak)",
      international: "Rp 20.000",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Kawasan benteng peninggalan Belanda era 1760 di titik sentral Malioboro",
      "Diorama peristiwa perjuangan kemerdekaan nasional yang dilengkapi teknologi interaktif",
      "Taman hijau terbuka asri dengan fasilitas kafe malam dan ruang istirahat yang nyaman",
    ],
    tips: [
      "Pilihan destinasi indoor terbaik saat cuaca luar sedang hujan lebat atau panas terik di kawasan Malioboro.",
      "Sangat ramah anak dan mudah diakses menggunakan kursi roda atau kereta bayi.",
      "Lokasinya tepat berseberangan dengan Titik Nol Kilometer dan Gedung Agung Yogyakarta.",
    ],
    tags: ["Indoor", "Sejarah Perjuangan", "Ramah Anak", "Malioboro", "Diorama"],
    bestTimeNote: "Kapan saja, ideal saat cuaca luar hujan atau terlalu terik",
  },
  "museum-sonobudoyo": {
    ticketPrice: {
      domestic: "Rp 10.000 (Gedung Utama), Rp 20.000 (Pameran Imersif)",
      international: "Rp 30.000",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Koleksi artefak kebudayaan Jawa terlengkap kedua di Indonesia setelah Museum Nasional",
      "Ruang pameran seni digital imersif modern dengan animasi visual sejarah Jawa yang memukau",
      "Pertunjukan wayang kulit ringkas setiap malam hari di pendopo museum",
    ],
    tips: [
      "Jangan lewatkan gedung baru yang memiliki wahana visual 360 derajat interaktif (tiket terpisah terjangkau).",
      "Seluruh ruang pameran tertutup ber-AC dingin, sangat nyaman untuk kunjungan edukasi siang hari.",
      "Berada persis di Alun-Alun Utara Yogyakarta, mudah dicapai dengan berjalan kaki dari Keraton.",
    ],
    tags: ["Museum Imersif", "Wayang Kulit", "Budaya Jawa", "Indoor Nyaman", "Edukasi"],
    bestTimeNote: "Siang hari untuk pameran atau malam hari untuk wayang kulit",
  },
  "museum-affandi": {
    ticketPrice: {
      domestic: "Rp 50.000 (Termasuk minuman sambutan & suvenir)",
      international: "Rp 100.000",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Galeri ratusan lukisan asli kanvas sang maestro seni ekspresionisme dunia, Affandi",
      "Arsitektur galeri unik rancangan Affandi sendiri yang terinspirasi pelepah daun pisang",
      "Koleksi mobil antik pribadi sang maestro dan makam keluarga di kompleks tepi sungai",
    ],
    tips: [
      "Tiket masuk sudah mencakup voucher minuman gratis yang dapat ditukarkan di kafe tepi sungai.",
      "Dilarang memotret dengan lampu kilat (flash) dan dilarang menyentuh permukaan lukisan.",
      "Suasana galeri rindang dan tenang di tepi Sungai Gajah Wong, pas untuk pecinta seni rupa.",
    ],
    tags: ["Seni Rupa", "Maestro Lukis", "Arsitektur Unik", "Tepi Sungai", "Indoor"],
    bestTimeNote: "Pagi atau siang hari pukul 09:30–13:00 WIB",
  },
  "museum-ullen-sentalu": {
    ticketPrice: {
      domestic: "Rp 50.000 (Tur Adiluhung Mataram)",
      international: "Rp 100.000",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Museum seni dan budaya Jawa berstandar internasional di kawasan sejuk lereng Merapi",
      "Pemandu museum profesional yang memandu tur dengan tutur kisah mendalam tentang putri-putri keraton",
      "Arsitektur bangunan batu andesit bertingkat di tengah hutan tropis alami Kaliurang",
    ],
    tips: [
      "Disarankan melakukan reservasi daring terlebih dahulu terutama di akhir pekan karena kapasitas tur terbatas.",
      "Pengambilan foto dan video dilarang di dalam ruang pamer demi menjaga kekhidmatan narasi budaya.",
      "Suhu udara di Kaliurang cukup sejuk, disarankan mengenakan pakaian hangat atau jaket ringan.",
    ],
    tags: ["Museum Terbaik", "Sejuk Merapi", "Budaya Keraton", "Tur Terpandu", "Estetik"],
    bestTimeNote: "Pagi hari pukul 09:00–11:30 WIB",
  },
  "desa-wisata-pentingsari": {
    ticketPrice: {
      domestic: "Bebas tiket masuk desa (Paket aktivitas mulai Rp 30.000)",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Desa wisata percontohan internasional peraih penghargaan pariwisata berkelanjutan",
      "Pengalaman membajak sawah, menanam padi, serta memainkan alat musik gamelan tradisional",
      "Homestay autentik di rumah-rumah warga lereng Gunung Merapi dengan keramahtamahan khas",
    ],
    tips: [
      "Paling berkesan bila mengikuti paket wisata terorganisir bersama keluarga atau kelompok.",
      "Bawalah pakaian ganti jika berencana mengikuti kegiatan susur sungai (river tubing) atau bertani.",
      "Cobalah kuliner olahan jamur dan kopi khas lereng Merapi yang disajikan warga desa.",
    ],
    tags: ["Desa Wisata", "Edukasi Tani", "Homestay", "Ramah Anak", "Lereng Merapi"],
    bestTimeNote: "Pagi hingga siang hari",
  },
  "desa-wisata-brayut": {
    ticketPrice: {
      domestic: "Bebas tiket masuk kawasan (Paket edukasi mulai Rp 25.000)",
      parking: "Motor Rp 2.000, Mobil Rp 5.000",
    },
    highlights: [
      "Kawasan perkampungan tradisional dengan deretan rumah joglo kuno bernuansa tempo doeloe",
      "Workshop seni tradisi: tari klasik Jawa, batik tulis, gamelan, dan kerajinan janur",
      "Hamparan bentang persawahan asri yang luas dengan udara pedesaan yang bersih",
    ],
    tips: [
      "Sangat cocok untuk sarana edukasi kebudayaan bagi anak-anak dan rombongan keluarga.",
      "Dapat menyewa sepeda ontel untuk mengitari jalan desa dan pematang sawah.",
      "Warga desa sangat ramah, jangan ragu berinteraksi dan berbincang dengan masyarakat lokal.",
    ],
    tags: ["Rumah Joglo", "Membatik", "Persawahan", "Kearifan Lokal", "Budaya"],
    bestTimeNote: "Pagi hari pukul 07:30–11:00 WIB",
  },
  "desa-wisata-kasongan": {
    ticketPrice: {
      domestic: "Bebas tiket masuk kawasan",
      parking: "Motor Rp 2.000, Mobil Rp 5.000",
    },
    highlights: [
      "Sentra industri kerajinan gerabah dan keramik tanah liat terbesar di Yogyakarta",
      "Praktik langsung membuat mangkuk dan patung mini dari tanah liat bersama perajin kawakan",
      "Ratusan galeri seni yang menjajakan guci, patung, perabot terakota, dan dekorasi rumah estetik",
    ],
    tips: [
      "Banyak galeri menyediakan kursus singkat membentuk gerabah menggunakan meja putar tradisional.",
      "Toko-toko menyediakan layanan pengemasan kayu dan pengiriman kargo bagi pembeli patung atau guci besar.",
      "Kenakan pakaian santai yang nyaman jika berencana mencoba memutar tanah liat langsung.",
    ],
    tags: ["Kerajinan Gerabah", "Belanja Interior", "Workshop Seni", "Oleh-oleh", "Keluarga"],
    bestTimeNote: "Pukul 09:00–16:00 WIB",
  },
  "desa-wisata-tembi": {
    ticketPrice: {
      domestic: "Bebas tiket masuk kawasan (Museum Rumah Budaya Tembi donasi sukarela)",
      parking: "Motor Rp 2.000, Mobil Rp 5.000",
    },
    highlights: [
      "Museum Rumah Budaya Tembi yang menyimpan naskah kuno, keris, dan dokumentasi sastra Jawa",
      "Pemandangan asri persawahan hijau diapit pepohonan nyiur yang damai",
      "Pilihan penginapan limasan tradisional dan warung kuliner masakan ndeso autentik",
    ],
    tips: [
      "Aktivitas terfavorit adalah jalan santai atau menyewa sepeda ontel di sepanjang jalan sawah saat sore hari.",
      "Cicipi hidangan tradisional khas Jawa di Warung Tembi dengan pemandangan langsung ke sawah.",
      "Pilihan tepat untuk mencari suasana hening dan menjauh sejenak dari hiruk pikuk kota.",
    ],
    tags: ["Rumah Budaya", "Tenang & Asri", "Kuliner Tradisional", "Sawah Hijau", "Sepeda Santai"],
    bestTimeNote: "Sore hari pukul 15:30–17:30 WIB",
  },
  "tebing-breksi": {
    ticketPrice: {
      domestic: "Rp 10.000 / orang",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Ukiran relief batu kapur artistik nan megah karya seniman lokal",
      "Panggung Amfiteater Tlatar Seneng untuk pertunjukan seni terbuka",
      "Panorama lanskap kota Yogyakarta dan Candi Prambanan dari ketinggian",
    ],
    tips: [
      "Gunakan alas kaki anti selip untuk menaiki anak tangga tebing yang curam.",
      "Disarankan datang pagi sebelum pukul 09:00 atau sore setelah pukul 16:00 untuk menghindari terik matahari di atas batuan.",
      "Bawa topi atau payung karena area puncak tebing minim naungan pohon.",
    ],
    tags: ["Tebing Kapur", "Spot Foto", "Sunset", "Keluarga", "Panorama"],
    bestTimeNote: "Sore hari pukul 16:00–18:00 WIB",
  },
  "candi-ijo": {
    ticketPrice: {
      domestic: "Rp 7.000 / orang",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Candi dengan elevasi tertinggi di Yogyakarta (410 mdpl)",
      "Spot panorama matahari terbenam spektakuler tanpa penghalang",
      "Halaman berundak yang tenang dan asri dengan udara sejuk perbukitan",
    ],
    tips: [
      "Senin kompleks candi tutup untuk pemeliharaan cagar budaya rutin.",
      "Waktu paling ideal tiba sekitar pukul 16:00 WIB agar tidak terburu-buru sebelum loket tutup pukul 17:00 WIB.",
      "Patuhi larangan memanjat atau duduk di atas bebatuan relief candi.",
    ],
    tags: ["Candi Hindu", "Sunset Terbaik", "Sejarah", "Panorama", "Cagar Budaya"],
    bestTimeNote: "Sore hari pukul 15:30–17:00 WIB",
  },
  "candi-sambisari": {
    ticketPrice: {
      domestic: "Rp 6.000 / orang",
      parking: "Motor Rp 2.000, Mobil Rp 5.000",
    },
    highlights: [
      "Arsitektur candi bawah tanah yang dikelilingi dinding rumput hijau rapi",
      "Ruang pameran artefak dan dokumentasi proses ekskavasi",
      "Suasana sejuk dan tenang di tengah perkampungan Kalasan",
    ],
    tips: [
      "Kunjungi saat pagi hari antara 07:30–09:30 saat rumput masih segar dan udara sejuk.",
      "Terdapat warung Soto Bathok otentik yang terkenal tepat di sebelah area candi.",
      "Gunakan tangga batu yang kokoh untuk menuruni area pelataran utama candi.",
    ],
    tags: ["Candi Bawah Tanah", "Cagar Budaya", "Edukasi", "Taman Asri", "Kuliner Sekitar"],
    bestTimeNote: "Pagi hari pukul 07:30–09:30 WIB",
  },
  "museum-gunungapi-merapi": {
    ticketPrice: {
      domestic: "Rp 10.000 / orang (Teater simulasi +Rp 5.000)",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Maket simulasi letusan Gunung Merapi berskala besar dengan efek suara & asap",
      "Koleksi sisa erupsi 2010 termasuk sepeda motor dan peralatan rumah tangga yang meleleh",
      "Teater audiovisual pemutaran film dokumenter vulkanologi",
    ],
    tips: [
      "Pilihan destinasi ramah hujan terbaik di kawasan Kaliurang karena seluruh pameran berada di dalam ruangan ber-AC.",
      "Hari Senin museum tutup untuk perawatan koleksi.",
      "Sangat cocok untuk wisata edukasi keluarga dan anak sekolah.",
    ],
    tags: ["Museum Edukasi", "Ramah Hujan", "Vulkanologi", "Indoor", "Keluarga"],
    bestTimeNote: "Pagi atau siang hari pukul 09:00–13:00 WIB",
  },
  "tlogo-putri-kaliurang": {
    ticketPrice: {
      domestic: "Rp 6.000 / orang (Retribusi TPR Kaliurang)",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Danau buatan dengan wahana perahu kayuh dan kano",
      "Udara sejuk khas pegunungan lereng Merapi (20–24°C)",
      "Pusat kuliner jadah tempe Mbah Carik dan sate kelinci khas Kaliurang",
    ],
    tips: [
      "Simpan makanan dan barang bawaan dalam tas rapat karena terdapat monyet ekor panjang liar.",
      "Bawa jaket atau pakaian hangat jika rentan terhadap udara dingin dataran tinggi.",
      "Hindari kunjungan saat hujan lebat karena jalanan lereng berkabut tebal.",
    ],
    tags: ["Pegunungan Sejuk", "Danau", "Wisata Alam", "Kuliner Tradisional", "Keluarga"],
    bestTimeNote: "Pagi hari pukul 08:00–11:00 WIB",
  },
  "goa-pindul": {
    ticketPrice: {
      domestic: "Rp 40.000 / orang (Termasuk ban pelampung, pelampung badan, & pemandu)",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Sensasi meluncur di atas ban pelampung di aliran sungai bawah tanah karst",
      "Zona terang, remang, dan gelap abadi dengan stalaktit terbesar nomor 4 di dunia",
      "Ruang gua terbuka dengan sinar matahari menembus langit-langit (cahaya surga)",
    ],
    tips: [
      "Bawa pakaian ganti lengkap dan kantong plastik tahan air (waterproof bag) untuk gawai.",
      "Tersedia fasilitas kamar mandi dan tempat bilas air tawar di pos operator.",
      "Saat musim hujan ekstrem, susur gua dapat ditutup sementara jika debit air sungai melonjak.",
    ],
    tags: ["Cave Tubing", "Gua Karst", "Petualangan", "Air", "Populer"],
    bestTimeNote: "Pagi hari pukul 08:00–11:00 WIB",
  },
  "pantai-drini": {
    ticketPrice: {
      domestic: "Rp 10.000 / orang (Retribusi TPR Terpadu)",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Pulau karang kecil di tengah laut yang bisa dinaiki via jembatan",
      "Wahana kano santai di perairan laguna sisi timur yang tenang",
      "Pasar ikan segar dan deretan warung kuliner tepi karang",
    ],
    tips: [
      "Sisi timur pantai aman untuk bermain air dan anak-anak, sedangkan sisi barat adalah jalur keluar-masuk perahu.",
      "Waktu pasang surut air terbaik untuk bermain kano adalah pagi hari.",
      "Gunakan sandal pantai bertapak tebal untuk melindungi kaki dari pecahan karang kecil.",
    ],
    tags: ["Pasir Putih", "Pulau Karang", "Wahana Kano", "Ramah Anak", "Kuliner Laut"],
    bestTimeNote: "Pagi hari 07:00–10:00 atau sore hari 15:30–17:30 WIB",
  },
  "pantai-wediombo": {
    ticketPrice: {
      domestic: "Rp 10.000 / orang (Retribusi TPR Girisubo)",
      parking: "Motor Rp 5.000, Mobil Rp 10.000",
    },
    highlights: [
      "Kolam renang laguna alami air asin yang terlindung benteng batu karang",
      "Spot memancing tebing laut (rock fishing) legendaris di DIY",
      "Panorama matahari terbenam tepat di garis cakrawala laut selatan",
    ],
    tips: [
      "Hanya berenang di dalam laguna alami saat air laut surut; hindari mendekati bibir tebing karang saat ombak pasang.",
      "Perjalanan dari pusat kota Jogja membutuhkan waktu sekitar 2 hingga 2,5 jam, persiapkan bahan bakar kendaraan.",
      "Bawa perlengkapan mandi ganti dan tabir surya.",
    ],
    tags: ["Kolam Alami", "Sunset", "Pasir Putih", "Laguna Karst", "Snorkeling"],
    bestTimeNote: "Sore hari pukul 15:30–18:00 WIB",
  },
  "puncak-becici": {
    ticketPrice: {
      domestic: "Rp 5.000 / orang",
      parking: "Motor Rp 2.000, Mobil Rp 5.000",
    },
    highlights: [
      "Gardu pandang kayu ikonik di pucuk pohon pinus menghadap lembah luas",
      "Kawasan hutan pinus rindang tempat mantan Presiden AS Barack Obama bersantai",
      "Fasilitas sewa hammock, panggung akustik alam, dan area perkemahan",
    ],
    tips: [
      "Waktu terbaik berkunjung adalah pukul 16:30 untuk menikmati semburat senja jingga di atas siluet pepohonan pinus.",
      "Jalur jalan setapak berbatu rapi dan ramah keluarga, namun tetap gunakan alas kaki nyaman.",
      "Tersedia banyak musala dan toilet bersih di area pintu masuk utama.",
    ],
    tags: ["Hutan Pinus", "Sunset", "Gardu Pandang", "Sejuk", "Keluarga"],
    bestTimeNote: "Sore hari pukul 16:00–18:00 WIB",
  },
  "hutan-pinus-pengger": {
    ticketPrice: {
      domestic: "Rp 5.000 / orang",
      parking: "Motor Rp 2.000, Mobil Rp 5.000",
    },
    highlights: [
      "Instalasi seni tangan raksasa 'Pancawara' menghadap kerlap-kerlip lampu kota Jogja",
      "Buka hingga malam hari (23.00 WIB) dengan lampu sorot artistik",
      "Hawa sejuk hutan pinus pegunungan Dlingo",
    ],
    tips: [
      "Datanglah menjelang petang sekitar pukul 17.30 untuk mendapatkan momen magis transisi senja ke pemandangan malam.",
      "Bawa jaket karena angin perbukitan pada malam hari cukup dingin.",
      "Tersedia jasa fotografer lokal dengan kamera profesional di tiap instalasi foto.",
    ],
    tags: ["Wisata Malam", "Citylight", "Spot Foto Seni", "Hutan Pinus", "Romantis"],
    bestTimeNote: "Sore hingga malam hari pukul 17:30–20:30 WIB",
  },
  "pantai-goa-cemara": {
    ticketPrice: {
      domestic: "Rp 10.000 / orang (Retribusi TPR Sanden)",
      parking: "Motor Rp 3.000, Mobil Rp 10.000",
    },
    highlights: [
      "Lorong kanopi hijau ribuan pohon cemara udang yang rimbun dan teduh",
      "Tempat konservasi dan pelepasan tukik (anak penyu) musiman",
      "Kawasan piknik keluarga dengan persewaan tikar dan kuliner kelapa muda",
    ],
    tips: [
      "Sangat nyaman untuk piknik siang hari karena terlindung dari terik matahari oleh kanopi pohon cemara.",
      "Dilarang berenang di laut lepas karena karakteristik ombak pantai selatan yang kuat.",
      "Bawa tikar atau alas duduk santai untuk bersantai bersama keluarga di bawah pepohonan.",
    ],
    tags: ["Hutan Cemara", "Teduh", "Piknik Keluarga", "Pantai Selatan", "Konservasi Penyu"],
    bestTimeNote: "Pagi hari 08:00–11:00 atau sore hari 15:00–17:30 WIB",
  },
  "waduk-sermo": {
    ticketPrice: {
      domestic: "Rp 6.000 / orang",
      parking: "Motor Rp 3.000, Mobil Rp 5.000",
    },
    highlights: [
      "Hamparan danau waduk tenang dengan latar lanskap Perbukitan Menoreh",
      "Area perkemahan tepi danau (camping ground) paling favorit di Yogyakarta",
      "Wahana keliling danau dengan perahu wisata dan kano",
    ],
    tips: [
      "Sangat direkomendasikan pagi hari pukul 06:30–08:30 WIB saat kabut tipis masih mengambang di atas permukaan danau.",
      "Jika berencana berkemah, siapkan perlengkapan tenda tahan air dan pakaian hangat.",
      "Jalanan menuju lokasi berliku di perbukitan, pastikan kondisi rem kendaraan prima.",
    ],
    tags: ["Danau Waduk", "Camping", "Perbukitan Menoreh", "Tenang", "Kano"],
    bestTimeNote: "Pagi hari pukul 06:30–09:00 WIB",
  },
  "museum-perjuangan-yogyakarta": {
    ticketPrice: {
      domestic: "Rp 5.000 / orang",
      parking: "Motor Rp 2.000, Mobil Rp 5.000",
    },
    highlights: [
      "Bentuk arsitektur gedung silinder unik perpaduan gaya Romawi dan candi timur",
      "Diorama peristiwa kemerdekaan dan pameran peninggalan pahlawan nasional",
      "Suasana museum indoor yang tenang di tengah kawasan Kota Yogyakarta",
    ],
    tips: [
      "Pilihan wisata edukasi sejarah indoor yang sangat pas saat siang terik atau cuaca hujan.",
      "Lokasi sangat dekat dengan Prawirotaman, cocok dipadukan dengan wisata kuliner.",
      "Hari Senin museum tutup untuk perawatan koleksi.",
    ],
    tags: ["Museum Sejarah", "Arsitektur Unik", "Indoor", "Ramah Hujan", "Edukasi"],
    bestTimeNote: "Pagi atau siang hari pukul 09:00–14:00 WIB",
  },
  "situs-warungboto": {
    ticketPrice: {
      domestic: "Gratis (Donasi sukarela)",
      parking: "Motor Rp 2.000, Mobil Rp 5.000",
    },
    highlights: [
      "Arsitektur lorong bata ekspos dan gerbang lengkung gaya pesanggrahan kuno",
      "Kolam pemandian mata air segidelapan yang ikonik dan simetris",
      "Lokasi favorit fotografi prewedding dan konten arsitektur sejarah",
    ],
    tips: [
      "Waktu terbaik untuk fotografi adalah pagi pukul 08.00–09.30 atau sore pukul 15.30 saat pencahayaan matahari miring menembus lorong.",
      "Jaga ketenangan karena situs berada di lingkungan pemukiman warga.",
      "Patuhi rambu untuk tidak memanjat struktur dinding bata tua.",
    ],
    tags: ["Situs Sejarah", "Arsitektur Kuno", "Spot Foto Estetik", "Cagar Budaya", "Gratis"],
    bestTimeNote: "Pagi hari 08:00–09:30 atau sore hari 15:30–17:00 WIB",
  },
  "blue-lagoon-jogja": {
    ticketPrice: {
      domestic: "Rp 10.000 / orang (Termasuk minuman sambutan)",
      parking: "Motor Rp 2.000, Mobil Rp 5.000",
    },
    highlights: [
      "Mata air alami yang sangat jernih bergradasi biru kehijauan",
      "Spot lompat tebing sungai (cliff jump) setinggi 3 meter",
      "Suasana pedesaan asri di bawah naungan rumpun bambu lebat",
    ],
    tips: [
      "Waktu terbaik berenang adalah pagi hari pukul 07.30–10.00 WIB saat air paling jernih dan belum ramai pengunjung.",
      "Tersedia persewaan pelampung, kacamata renang, dan ban air.",
      "Bawa pakaian ganti dan perlengkapan mandi.",
    ],
    tags: ["Mata Air Alami", "Berenang", "Bambu Rindang", "Sejuk", "Keluarga"],
    bestTimeNote: "Pagi hari pukul 07:30–10:00 WIB",
  },
  "puncak-suroloyo": {
    ticketPrice: {
      domestic: "Rp 5.000 / orang",
      parking: "Motor Rp 2.000, Mobil Rp 5.000",
    },
    highlights: [
      "Puncak tertinggi Pegunungan Menoreh di ketinggian 1.019 mdpl",
      "Pemandangan 4 gunung besar (Merapi, Merbabu, Sumbing, Sindoro) dan Candi Borobudur saat cuaca cerah",
      "Wisata petualangan menaiki 286 anak tangga menuju gardu pandang Suroloyo",
    ],
    tips: [
      "Waktu terbaik adalah pagi buta pukul 05:00–07:00 WIB untuk menyaksikan matahari terbit di atas lautan awan.",
      "Jalur jalan pegunungan cukup menanjak dan berliku, gunakan kendaraan berkondisi prima.",
      "Bawa jaket tebal karena suhu udara pagi hari berkisar 16–19°C.",
    ],
    tags: ["Puncak Gunung", "Sunrise", "Negeri Di Atas Awan", "Menoreh", "Petualangan"],
    bestTimeNote: "Pagi hari pukul 05:00–07:30 WIB",
  },
};

export function getDestinationEnrichment(slug: string): DestinationEnrichment | undefined {
  return ENRICHMENT_DATA[slug];
}

export function getAllEnrichedTags(): string[] {
  const set = new Set<string>();
  for (const item of Object.values(ENRICHMENT_DATA)) {
    for (const tag of item.tags) {
      set.add(tag);
    }
  }
  return Array.from(set).sort();
}
