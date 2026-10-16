// Pemahaman maksud pertanyaan secara deterministik. Dipakai sebagai (a) pengaman yang menimpa
// keluaran model untuk hal yang pasti, dan (b) cadangan penuh bila model tidak tersedia.

import type { DestCategory } from "../categories";
import { normalize } from "./text";

export const INTENTS = [
  "recommend",
  "compare",
  "itinerary",
  "info",
  "explain",
  "alternative",
  "app_help",
  "clarify",
  "unsupported",
  "out_of_scope",
] as const;
export type AssistantIntent = (typeof INTENTS)[number];

export const TOPICS = ["lokasi", "jam_buka", "tiket", "fasilitas", "cuaca", "tips", "sorotan", "jarak"] as const;
export type Topic = (typeof TOPICS)[number];

export const PREFERENCES = ["teduh", "hujan", "keluarga", "sunset", "foto", "murah"] as const;
export type Preference = (typeof PREFERENCES)[number];

export type UnsupportedKind = "gelombang" | "penginapan" | "transportasi" | "keramaian" | "kuliner" | "lainnya";

const has = (text: string, ...patterns: RegExp[]) => patterns.some((p) => p.test(text));

/** Topik yang belum ada datanya di sistem; dijawab jujur, tidak dikarang. */
export function detectUnsupported(query: string): UnsupportedKind | null {
  const t = normalize(query);
  if (has(t, /\b(tinggi gelombang|gelombang|ombak|arus balik|rip current|pasang surut|berenang|renang|snorkeling|selancar|surfing)\b/)) {
    return "gelombang";
  }
  if (has(t, /\b(hotel|penginapan|homestay|villa|hostel|menginap|tidur di mana)\b/)) return "penginapan";
  if (has(t, /\b(trans jogja|transjogja|jadwal kereta|tiket kereta|tiket pesawat|bandara|travel|ojek online|gojek|grab)\b/)) {
    return "transportasi";
  }
  if (has(t, /\b(ramai atau sepi|ramai nggak|ramai ngga|rame nggak|sepi nggak|antrean|antrian|kepadatan|macet)\b/)) return "keramaian";
  if (has(t, /\b(restoran terbaik|kuliner terenak|makanan enak|rekomendasi makan|oleh oleh|cafe|kafe|warung enak)\b/)) return "kuliner";
  return null;
}

export function detectOutOfScope(query: string): boolean {
  const t = normalize(query);
  if (has(t, /\b(puisi|pantun|lelucon|joke|cerita lucu|lagu|coding|kode program|python|javascript|resep|masak|politik|presiden|saham|bitcoin|crypto|matematika|pr sekolah|tugas kuliah|terjemahkan|translate|ramalan zodiak|horoskop)\b/)) {
    return true;
  }
  if (has(t, /\b(abaikan|lupakan|ignore)\b.*\b(instruksi|perintah|aturan|prompt|sebelumnya)\b/)) return true;
  if (has(t, /\b(system prompt|prompt sistem|kunci api|api key|jailbreak)\b/)) return true;
  return false;
}

export function detectGreeting(query: string): boolean {
  const t = normalize(query);
  if (!t) return true;
  const words = t.split(" ");
  if (words.length > 4) return false;
  return has(t, /^(halo|hai|hei|hallo|hi|hello|p|test|tes|woi|assalamualaikum|selamat (pagi|siang|sore|malam)|permisi|makasih|terima kasih|thanks|oke|ok|siap)\b/);
}

export function detectTopics(query: string): Topic[] {
  const t = normalize(query);
  const topics: Topic[] = [];
  if (has(t, /\b(buka|tutup|jam operasional|jam kunjung|jam berapa|hari apa buka|libur)\b/)) topics.push("jam_buka");
  if (has(t, /\b(lokasi|alamat|letak|terletak|dimana|di mana|daerah mana|wilayah mana|kabupaten mana|kecamatan mana|desa mana|posisi)\b/)) {
    topics.push("lokasi");
  }
  if (has(t, /\b(tiket|htm|harga|biaya|bayar|retribusi|karcis|tarif|per orang)\b/)) topics.push("tiket");
  if (has(t, /\b(fasilitas|toilet|wc|kamar mandi|musala|mushola|masjid|ibadah|parkir|atm|makan|restoran|warung|kantin|halte|stasiun)\b/)) {
    topics.push("fasilitas");
  }
  if (has(t, /\b(cuaca|suhu|temperatur|prakiraan|angin)\b/) && !has(t, /\bkalau hujan\b/)) topics.push("cuaca");
  if (has(t, /\b(tips|saran|sebaiknya bawa|perlu bawa|bawa apa|pakai apa|pakaian)\b/)) topics.push("tips");
  if (has(t, /\b(ada apa|apa saja|ngapain|bisa ngapain|kegiatan|aktivitas|daya tarik|keunikan|highlight|spot|menarik)\b/)) topics.push("sorotan");
  if (has(t, /\b(jarak|berapa km|berapa kilo|rute|naik apa|berapa lama|perjalanan dari)\b/)) topics.push("jarak");
  return topics;
}

export function detectPreferences(query: string): Preference[] {
  const t = normalize(query);
  const prefs = new Set<Preference>();
  if (has(t, /\b(sejuk|adem|teduh|kepanasan|panas|terik|gerah|ac|indoor|dalam ruangan|tertutup|berteduh)\b/)) prefs.add("teduh");
  if (has(t, /\b(hujan|kehujanan|basah|gerimis|mendung)\b/)) prefs.add("hujan");
  if (has(t, /\b(anak|balita|bayi|keluarga|orang tua|ortu|lansia|nenek|kakek|stroller)\b/)) prefs.add("keluarga");
  if (has(t, /\b(sunset|sunsetan|senja|matahari terbenam)\b/)) prefs.add("sunset");
  if (has(t, /\b(foto|fotografi|instagramable|estetik|selfie)\b/)) prefs.add("foto");
  if (has(t, /\b(murah|gratis|hemat|irit|budget|tiket termurah)\b/)) prefs.add("murah");
  return [...prefs];
}

export function detectCategories(query: string): DestCategory[] {
  const t = normalize(query);
  const cats = new Set<DestCategory>();
  if (has(t, /\b(pantai|laut|pesisir)\b/)) cats.add("pantai");
  if (has(t, /\b(alam|gunung|hutan|pendakian|trekking|hiking|bukit|pemandangan)\b/)) cats.add("alam");
  if (has(t, /\b(budaya|candi|sejarah|keraton|kraton|bersejarah|heritage)\b/)) cats.add("budaya");
  if (has(t, /\bmuseum\b/)) cats.add("museum");
  if (has(t, /\b(desa wisata|desa|kampung)\b/)) cats.add("desa_wisata");
  return [...cats];
}

const ORDINALS: [RegExp, number][] = [
  [/\b(pertama|satu|1|teratas|paling atas)\b/, 0],
  [/\b(kedua|dua|2)\b/, 1],
  [/\b(ketiga|tiga|3)\b/, 2],
];

/** Indeks (0-based) bila pengguna merujuk "yang kedua"/"nomor 3" pada daftar sebelumnya. */
export function detectOrdinal(query: string): number | null {
  const t = normalize(query);
  if (!/\b(yang|nomor|no|urutan|pilihan)\b/.test(t)) return null;
  for (const [pattern, index] of ORDINALS) if (pattern.test(t)) return index;
  return null;
}

/** Pengguna merujuk hasil sebelumnya tanpa menyebut nama ("itu", "tadi", "di sana"). */
export function refersToPrevious(query: string): boolean {
  const t = normalize(query);
  return (
    has(t, /\b(itu|tadi|tersebut|di sana|disana|situ|yang tadi|yang itu|dia|tempat ini|kedua|ketiga|semua|keduanya|ketiganya|semuanya)\b/) ||
    detectOrdinal(query) !== null
  );
}

export type DeterministicIntent = {
  intent: AssistantIntent;
  unsupported: UnsupportedKind | null;
};

/**
 * Tentukan maksud tanpa model. `mentionCount` = jumlah destinasi katalog yang disebut,
 * `hasFocus` = ada hasil sebelumnya yang bisa dirujuk.
 */
export function detectIntent(query: string, mentionCount: number, hasFocus: boolean): DeterministicIntent {
  const t = normalize(query);
  const unsupported = detectUnsupported(query);
  const topics = detectTopics(query);

  if (detectOutOfScope(query)) return { intent: "out_of_scope", unsupported: null };
  if (unsupported) return { intent: "unsupported", unsupported };
  if (detectGreeting(query)) return { intent: "clarify", unsupported: null };

  if (has(t, /\b(rencana|itinerary|susun|jadwal perjalanan|rute wisata|seharian|sehari penuh|1 hari|satu hari|2 hari|dua hari|3 hari|tiga hari|jalan jalan sehari)\b/)) {
    return { intent: "itinerary", unsupported: null };
  }
  if (
    (mentionCount >= 2 &&
      has(t, /\b(banding|bandingkan|dibandingkan|atau|vs|versus|mana (yang )?(lebih|paling)|lebih (bagus|baik|aman|nyaman|cocok|recommended|enak)|pilih)\b/)) ||
    // Satu nama saja ("bandingkan Parangtritis dengan yang lain"): tetap perbandingan, mesin akan menanyakan pembandingnya.
    (mentionCount === 1 && has(t, /\b(banding|bandingkan|dibandingkan|vs|versus)\b/))
  ) {
    return { intent: "compare", unsupported: null };
  }
  if (has(t, /\b(kenapa|mengapa|alasan|penyebab)\b/) && has(t, /\b(skor|nilai|rendah|tinggi|kurang|bagus|jelek|tutup)\b/)) {
    return { intent: "explain", unsupported: null };
  }
  if (has(t, /\b(cara|bagaimana|gimana|kenapa)\b/) && has(t, /\b(simpan|login|masuk|daftar|akun|skor dihitung|dihitung|hitung|pakai|menggunakan|rencana saya)\b/)) {
    return { intent: "app_help", unsupported: null };
  }
  if (has(t, /\b(apa itu wistara|siapa kamu|kamu siapa|kamu bisa apa|bisa apa saja|fitur|bantuan|help|arti skor|sumber data|data dari mana)\b/)) {
    return { intent: "app_help", unsupported: null };
  }
  if (topics.length > 0 && (mentionCount > 0 || (hasFocus && refersToPrevious(query)))) {
    // "kalau hujan ..." bukan pertanyaan info
    if (!has(t, /\b(kalau hujan|jika hujan|alternatif|pengganti)\b/)) return { intent: "info", unsupported: null };
  }
  if (has(t, /\b(alternatif|pengganti|kalau hujan|jika hujan|saat hujan|pas hujan|kehujanan|rainy)\b/)) {
    return { intent: "alternative", unsupported: null };
  }
  if (topics.length > 0 && mentionCount === 0) {
    // Pertanyaan topik tanpa destinasi jelas ("buka jam berapa?"): perlu ditanyakan balik, bukan ditebak.
    return { intent: "info", unsupported: null };
  }
  if (
    has(t, /\b(ke mana|kemana|rekomendasi|rekomendasikan|enaknya|bagusnya|tempat|wisata|destinasi|pantai|candi|museum|desa|cocok|sejuk|sunset|senja|mau|pengen|ingin|cari|saran)\b/) ||
    mentionCount > 0
  ) {
    return { intent: mentionCount === 1 && topics.length === 0 && !has(t, /\b(ke mana|kemana|rekomendasi|cocok)\b/) ? "info" : "recommend", unsupported: null };
  }
  return { intent: "clarify", unsupported: null };
}
