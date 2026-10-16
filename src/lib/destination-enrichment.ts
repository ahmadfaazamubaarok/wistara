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
