// Atribut praktis destinasi untuk pertimbangan mesin AI (cuaca, slot siang terik, dan slot senja).
// Dirancang berskala (scalable): 20 destinasi percontohan memiliki rujukan data terkurasi,
// sementara destinasi baru di luar katalog percontohan otomatis menggunakan nilai bawaan (fallback).

export type DestinationAttribute = {
  /** Terlindung dari panas terik: ruang pameran beratap/ber-AC atau kanopi pohon lebat. */
  isShadedOrIndoor: boolean;
  /** Titik pandang panorama matahari terbenam (arah barat/selatan terbuka). */
  isSunsetSpot: boolean;
  /** Sumber rujukan verifikasi data atribut. */
  source?: string;
};

const PILOT_DESTINATION_ATTRIBUTES: Record<string, DestinationAttribute> = {
  "pantai-parangtritis": {
    isShadedOrIndoor: false,
    isSunsetSpot: true,
    source: "Pesisir selatan Bantul menghadap barat daya (Spot Sunset Populer)",
  },
  "pantai-indrayanti": {
    isShadedOrIndoor: false,
    isSunsetSpot: false,
    source: "Pantai berpasir putih diapit tebing karang timur",
  },
  "pantai-baron": {
    isShadedOrIndoor: false,
    isSunsetSpot: false,
    source: "Cekungan muara sungai bawah tanah dan pelelangan ikan",
  },
  "pantai-glagah": {
    isShadedOrIndoor: false,
    isSunsetSpot: true,
    source: "Kawasan pemecah ombak pesisir barat daya Kulon Progo",
  },
  "gumuk-pasir-parangkusumo": {
    isShadedOrIndoor: false,
    isSunsetSpot: true,
    source: "Hamparan bukit pasir pesisir terbuka dengan horizon barat luas",
  },
  "gunung-api-purba-nglanggeran": {
    isShadedOrIndoor: false,
    isSunsetSpot: false,
    source: "Jalur pendakian bukit batu alam terbuka",
  },
  "hutan-pinus-mangunan": {
    isShadedOrIndoor: true,
    isSunsetSpot: false,
    source: "Kanopi rapat pohon pinus menciptakan peneduh alami sepanjang hari",
  },
  "kalibiru": {
    isShadedOrIndoor: false,
    isSunsetSpot: true,
    source: "Gardu pandang perbukitan Menoreh menghadap Waduk Sermo barat",
  },
  "keraton-yogyakarta": {
    isShadedOrIndoor: false,
    isSunsetSpot: false,
    source: "Kompleks istana budaya (jam buka reguler sampai 14.00 WIB)",
  },
  "taman-sari": {
    isShadedOrIndoor: false,
    isSunsetSpot: false,
    source: "Kompleks pemandian cagar budaya (jam operasional sampai 15.00 WIB)",
  },
  "candi-prambanan": {
    isShadedOrIndoor: false,
    isSunsetSpot: false,
    source: "Pelataran taman purbakala terbuka luas",
  },
  "candi-ratu-boko": {
    isShadedOrIndoor: false,
    isSunsetSpot: true,
    source: "Pelataran gerbang istana bukit Boko ternama untuk panorama senja",
  },
  "museum-benteng-vredeburg": {
    isShadedOrIndoor: true,
    isSunsetSpot: false,
    source: "Gedung diorama pameran sejarah tertutup ber-AC",
  },
  "museum-sonobudoyo": {
    isShadedOrIndoor: true,
    isSunsetSpot: false,
    source: "Gedung pameran artefak dan ruang seni imersif visual ber-AC",
  },
  "museum-affandi": {
    isShadedOrIndoor: true,
    isSunsetSpot: false,
    source: "Galeri seni lukis tertutup di tepi Sungai Gajah Wong",
  },
  "museum-ullen-sentalu": {
    isShadedOrIndoor: true,
    isSunsetSpot: false,
    source: "Galeri seni budaya tertutup berhawa dingin lereng Merapi",
  },
  "desa-wisata-pentingsari": {
    isShadedOrIndoor: false,
    isSunsetSpot: false,
    source: "Kawasan aktivitas luar ruang pedesaan lereng Merapi",
  },
  "desa-wisata-brayut": {
    isShadedOrIndoor: false,
    isSunsetSpot: false,
    source: "Pusat edukasi pertanian dan kesenian luar ruang",
  },
  "desa-wisata-kasongan": {
    isShadedOrIndoor: true,
    isSunsetSpot: false,
    source: "Deretan galeri & showroom gerabah keramik tertutup",
  },
  "desa-wisata-tembi": {
    isShadedOrIndoor: false,
    isSunsetSpot: false,
    source: "Kawasan sanggar budaya dan kuliner tradisional",
  },
};

/**
 * Mengambil atribut cuaca/lingkungan suatu destinasi.
 * Bila destinasi belum ada dalam katalog kurasi awal (mis. saat sistem diekspansi ke provinsi lain),
 * fungsi ini tetap bekerja secara aman (scalable) dengan memakai fallback `isIndoor`.
 */
export function getDestinationAttribute(slug: string, fallbackIsIndoor = false): DestinationAttribute {
  const existing = PILOT_DESTINATION_ATTRIBUTES[slug];
  if (existing) return existing;

  return {
    isShadedOrIndoor: fallbackIsIndoor,
    isSunsetSpot: false,
    source: "Bawaan sistem (berdasarkan status indoor)",
  };
}
