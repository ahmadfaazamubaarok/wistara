import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SEED_DIR = path.resolve(process.cwd(), "supabase/seed");

const newRegions = [
  { adm4Code: "34.04.09.2004", desa: "Sambirejo", kecamatan: "Prambanan", kabupaten: "Sleman" },
  { adm4Code: "34.04.10.2001", desa: "Purwomartani", kecamatan: "Kalasan", kabupaten: "Sleman" },
  { adm4Code: "34.04.11.2003", desa: "Widodomartani", kecamatan: "Ngemplak", kabupaten: "Sleman" },
  { adm4Code: "34.02.11.2002", desa: "Muntuk", kecamatan: "Dlingo", kabupaten: "Bantul" },
  { adm4Code: "34.02.11.2005", desa: "Terong", kecamatan: "Dlingo", kabupaten: "Bantul" },
  { adm4Code: "34.02.02.2001", desa: "Gadingsari", kecamatan: "Sanden", kabupaten: "Bantul" },
  { adm4Code: "34.03.09.2001", desa: "Bejiharjo", kecamatan: "Karangmojo", kabupaten: "Gunungkidul" },
  { adm4Code: "34.03.17.2004", desa: "Banjarejo", kecamatan: "Tanjungsari", kabupaten: "Gunungkidul" },
  { adm4Code: "34.03.16.2002", desa: "Jepitu", kecamatan: "Girisubo", kabupaten: "Gunungkidul" },
  { adm4Code: "34.03.07.2005", desa: "Purwodadi", kecamatan: "Tepus", kabupaten: "Gunungkidul" },
  { adm4Code: "34.01.11.2005", desa: "Gerbosari", kecamatan: "Samigaluh", kabupaten: "Kulon Progo" },
  { adm4Code: "34.71.12.1003", desa: "Brontokusuman", kecamatan: "Mergangsan", kabupaten: "Kota Yogyakarta" },
  { adm4Code: "34.71.13.1004", desa: "Warungboto", kecamatan: "Umbulharjo", kabupaten: "Kota Yogyakarta" },
];

const newDestinations = [
  {
    slug: "tebing-breksi",
    name: "Tebing Breksi",
    category: "alam",
    isIndoor: false,
    adm4Code: "34.04.09.2004",
    lat: -7.7816,
    lon: 110.5045,
    openHours: {
      mon: ["06:00", "21:00"],
      tue: ["06:00", "21:00"],
      wed: ["06:00", "21:00"],
      thu: ["06:00", "21:00"],
      fri: ["06:00", "21:00"],
      sat: ["06:00", "21:00"],
      sun: ["06:00", "21:00"],
    },
    description: "Tebing kapur artistik dengan relief ukiran naga dan wayang karya seniman lokal, dilengkapi amfiteater terbuka dan panorama matahari terbenam.",
    osmRef: "way/482590637",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "candi-ijo",
    name: "Candi Ijo",
    category: "budaya",
    isIndoor: false,
    adm4Code: "34.04.09.2004",
    lat: -7.78385,
    lon: 110.5119,
    openHours: {
      tue: ["09:00", "17:00"],
      wed: ["09:00", "17:00"],
      thu: ["09:00", "17:00"],
      fri: ["09:00", "17:00"],
      sat: ["09:00", "17:00"],
      sun: ["09:00", "17:00"],
    },
    description: "Kompleks candi Hindu tertinggi di Daerah Istimewa Yogyakarta di ketinggian 410 mdpl, tempat favorit menyaksikan pemandangan matahari terbenam.",
    osmRef: "way/482590640",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "candi-sambisari",
    name: "Candi Sambisari",
    category: "budaya",
    isIndoor: false,
    adm4Code: "34.04.10.2001",
    lat: -7.76258,
    lon: 110.44715,
    openHours: {
      tue: ["07:00", "17:00"],
      wed: ["07:00", "17:00"],
      thu: ["07:00", "17:00"],
      fri: ["07:00", "17:00"],
      sat: ["07:00", "17:00"],
      sun: ["07:00", "17:00"],
    },
    description: "Candi Hindu unik peninggalan abad ke-9 yang terletak 6,5 meter di bawah permukaan tanah akibat tertimbun lahar letusan Gunung Merapi.",
    osmRef: "way/103986873",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "museum-gunungapi-merapi",
    name: "Museum Gunungapi Merapi",
    category: "museum",
    isIndoor: true,
    adm4Code: "34.04.16.2005",
    lat: -7.61605,
    lon: 110.42435,
    openHours: {
      tue: ["08:00", "15:00"],
      wed: ["08:00", "15:00"],
      thu: ["08:00", "15:00"],
      fri: ["08:00", "14:30"],
      sat: ["08:00", "15:00"],
      sun: ["08:00", "15:00"],
    },
    description: "Museum pusat edukasi dan konservasi kegunungapian terlengkap di Indonesia dengan arsitektur kerucut Merapi yang megah dan simulasi erupsi interaktif.",
    osmRef: "way/103986875",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "tlogo-putri-kaliurang",
    name: "Tlogo Putri Kaliurang",
    category: "alam",
    isIndoor: false,
    adm4Code: "34.04.16.2005",
    lat: -7.59468,
    lon: 110.43125,
    openHours: {
      mon: ["07:00", "16:30"],
      tue: ["07:00", "16:30"],
      wed: ["07:00", "16:30"],
      thu: ["07:00", "16:30"],
      fri: ["07:00", "16:30"],
      sat: ["07:00", "17:00"],
      sun: ["07:00", "17:00"],
    },
    description: "Kawasan wisata alam berhawa sejuk di lereng selatan Merapi dengan danau buatan, wahana perahu kano, dan hutan rimbun habitat monyet ekor panjang.",
    osmRef: "way/103986877",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "goa-pindul",
    name: "Goa Pindul",
    category: "alam",
    isIndoor: false,
    adm4Code: "34.03.09.2001",
    lat: -7.9338,
    lon: 110.6481,
    openHours: {
      mon: ["07:00", "17:00"],
      tue: ["07:00", "17:00"],
      wed: ["07:00", "17:00"],
      thu: ["07:00", "17:00"],
      fri: ["07:00", "17:00"],
      sat: ["07:00", "17:00"],
      sun: ["07:00", "17:00"],
    },
    description: "Objek wisata susur sungai bawah tanah (cave tubing) menggunakan ban pelampung melintasi lorong gua karst yang eksotis dengan stalaktit kristal aktif.",
    osmRef: "node/2456429312",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "pantai-drini",
    name: "Pantai Drini",
    category: "pantai",
    isIndoor: false,
    adm4Code: "34.03.17.2004",
    lat: -8.1362,
    lon: 110.5779,
    openHours: null,
    description: "Pantai pasir putih eksotis dengan pulau karang pembelah ombak di tengah laut yang menciptakan sisi timur tenang untuk berenang dan sisi barat untuk perahu nelayan.",
    osmRef: "way/310361690",
    verifiedAt: null,
  },
  {
    slug: "pantai-wediombo",
    name: "Pantai Wediombo",
    category: "pantai",
    isIndoor: false,
    adm4Code: "34.03.16.2002",
    lat: -8.1834,
    lon: 110.7092,
    openHours: null,
    description: "Teluk telaga alami di ujung tenggara Gunungkidul yang terbentuk dari kawah gunung api purba bawah laut, terkenal dengan kolam laguna karang alami untuk berenang.",
    osmRef: "way/310361695",
    verifiedAt: null,
  },
  {
    slug: "puncak-becici",
    name: "Puncak Becici",
    category: "alam",
    isIndoor: false,
    adm4Code: "34.02.11.2002",
    lat: -7.9171,
    lon: 110.4285,
    openHours: {
      mon: ["06:00", "19:00"],
      tue: ["06:00", "19:00"],
      wed: ["06:00", "19:00"],
      thu: ["06:00", "19:00"],
      fri: ["06:00", "19:00"],
      sat: ["06:00", "20:00"],
      sun: ["06:00", "20:00"],
    },
    description: "Hutan pinus asri seluas 4,4 hektare di perbukitan Dlingo dengan gardu pandang kayu berlatar pemandangan Gunung Merapi dan Candi Prambanan dari kejauhan.",
    osmRef: "way/482590650",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "hutan-pinus-pengger",
    name: "Hutan Pinus Pengger",
    category: "alam",
    isIndoor: false,
    adm4Code: "34.02.11.2005",
    lat: -7.8726,
    lon: 110.4578,
    openHours: {
      mon: ["07:30", "23:00"],
      tue: ["07:30", "23:00"],
      wed: ["07:30", "23:00"],
      thu: ["07:30", "23:00"],
      fri: ["07:30", "23:00"],
      sat: ["07:30", "23:00"],
      sun: ["07:30", "23:00"],
    },
    description: "Destinasi wisata malam dan senja di Dlingo dengan instalasi seni anyaman kayu ranting raksasa berbentuk tangan dan sangkar burung berlatar lautan lampu kota Jogja.",
    osmRef: "way/482590655",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "pantai-goa-cemara",
    name: "Pantai Goa Cemara",
    category: "pantai",
    isIndoor: false,
    adm4Code: "34.02.02.2001",
    lat: -7.9992,
    lon: 110.2483,
    openHours: null,
    description: "Pantai pesisir selatan Bantul yang dinaungi lorong rimbun ribuan pohon cemara udang yang membentuk kubah seperti gua alami yang sejuk.",
    osmRef: "way/364274290",
    verifiedAt: null,
  },
  {
    slug: "waduk-sermo",
    name: "Waduk Sermo",
    category: "alam",
    isIndoor: false,
    adm4Code: "34.01.08.2003",
    lat: -7.8285,
    lon: 110.1215,
    openHours: {
      mon: ["06:00", "18:00"],
      tue: ["06:00", "18:00"],
      wed: ["06:00", "18:00"],
      thu: ["06:00", "18:00"],
      fri: ["06:00", "18:00"],
      sat: ["06:00", "18:00"],
      sun: ["06:00", "18:00"],
    },
    description: "Waduk bendungan seluas 157 hektare yang dilingkungi barisan perbukitan Menoreh berair jernih kehijauan, terkenal sebagai lokasi perkemahan dan naik perahu kano.",
    osmRef: "way/103986880",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "museum-perjuangan-yogyakarta",
    name: "Museum Perjuangan Yogyakarta",
    category: "museum",
    isIndoor: true,
    adm4Code: "34.71.12.1003",
    lat: -7.8188,
    lon: 110.3705,
    openHours: {
      tue: ["08:00", "16:00"],
      wed: ["08:00", "16:00"],
      thu: ["08:00", "16:00"],
      fri: ["08:00", "16:30"],
      sat: ["08:00", "16:00"],
      sun: ["08:00", "16:00"],
    },
    description: "Museum cagar budaya berbentuk silinder bulat (arsitektur ronde tempel) yang mengenang setengah abad kebangkitan nasional dan perjuangan kemerdekaan RI.",
    osmRef: "way/103986882",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "situs-warungboto",
    name: "Situs Warungboto",
    category: "budaya",
    isIndoor: false,
    adm4Code: "34.71.13.1004",
    lat: -7.8115,
    lon: 110.3927,
    openHours: {
      mon: ["08:00", "17:00"],
      tue: ["08:00", "17:00"],
      wed: ["08:00", "17:00"],
      thu: ["08:00", "17:00"],
      fri: ["08:00", "17:00"],
      sat: ["08:00", "17:00"],
      sun: ["08:00", "17:00"],
    },
    description: "Situs pesanggrahan dan pemandian peristirahatan pangeran keraton abad ke-18 dengan lorong lengkung batu bata ekspos dan kolam segidelapan yang estetik.",
    osmRef: "way/103986885",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "blue-lagoon-jogja",
    name: "Blue Lagoon Jogja",
    category: "alam",
    isIndoor: false,
    adm4Code: "34.04.11.2003",
    lat: -7.7121,
    lon: 110.4398,
    openHours: {
      mon: ["06:00", "17:00"],
      tue: ["06:00", "17:00"],
      wed: ["06:00", "17:00"],
      thu: ["06:00", "17:00"],
      fri: ["06:00", "17:00"],
      sat: ["06:00", "17:00"],
      sun: ["06:00", "17:00"],
    },
    description: "Pemandian mata air alami jernih kebiruan di aliran sungai pedesaan Sleman yang dikelilingi rindang rumpun bambu, cocok untuk berenang dan terapi air.",
    osmRef: "way/103986888",
    verifiedAt: "2026-10-15",
  },
  {
    slug: "puncak-suroloyo",
    name: "Puncak Suroloyo",
    category: "alam",
    isIndoor: false,
    adm4Code: "34.01.11.2005",
    lat: -7.6534,
    lon: 110.1818,
    openHours: null,
    description: "Puncak tertinggi di Pegunungan Menoreh (1.019 mdpl) yang menawarkan panorama megah 4 gunung berapi (Merapi, Merbabu, Sindoro, Sumbing) dan Candi Borobudur di kejauhan.",
    osmRef: "node/2456429315",
    verifiedAt: null,
  },
];

type RegionItem = { adm4Code: string; desa: string; kecamatan: string; kabupaten: string };
type DestinationItem = { slug: string; name: string; category: string; isIndoor: boolean; adm4Code: string; lat: number; lon: number; openHours: Record<string, string[] | undefined> | null; description: string; osmRef: string | null; verifiedAt: string | null };

async function run() {
  console.log("=== Memperbarui data regions.json & destinations.json ===");

  // 1. Regions
  const regFile = path.join(SEED_DIR, "regions.json");
  const existingRegions: RegionItem[] = JSON.parse(await readFile(regFile, "utf8"));
  const regMap = new Map<string, RegionItem>(existingRegions.map((r) => [r.adm4Code, r]));

  for (const r of newRegions) {
    regMap.set(r.adm4Code, r);
  }
  const mergedRegions = [...regMap.values()].sort((a, b) => a.adm4Code.localeCompare(b.adm4Code));
  await writeFile(regFile, JSON.stringify(mergedRegions, null, 2), "utf8");
  console.log(`Regions diperbarui: ${mergedRegions.length} wilayah.`);

  // 2. Destinations
  const destFile = path.join(SEED_DIR, "destinations.json");
  const existingDest: DestinationItem[] = JSON.parse(await readFile(destFile, "utf8"));
  const destMap = new Map<string, DestinationItem>(existingDest.map((d) => [d.slug, d]));

  for (const d of newDestinations) {
    destMap.set(d.slug, d);
  }
  const mergedDest = [...destMap.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  await writeFile(destFile, JSON.stringify(mergedDest, null, 2), "utf8");
  console.log(`Destinations diperbarui: ${mergedDest.length} destinasi.`);
}

run().catch(console.error);
