// Penyelesaian entitas: mengenali destinasi katalog yang disebut pengguna, termasuk
// penulisan tidak baku ("desa tembi", "kraton", "ulen sentalu") dan salah ketik ringan.
// Tidak pernah menebak: bila tidak ada yang cocok, hasilnya kosong dan pemanggil harus bertanya balik.

import { dice, levenshtein, normalize } from "./text";

export type CatalogEntry = { slug: string; name: string };
export type Mention = { slug: string; index: number; fuzzy: boolean };

/** Kata umum pada nama destinasi yang tidak cukup khas untuk mengenali satu tempat. */
const GENERIC = new Set([
  "desa", "wisata", "candi", "pantai", "museum", "gunung", "taman", "hutan", "keraton", "kawasan",
  "yogyakarta", "jogja", "yogya", "diy", "di", "dan", "the",
]);

/** Nama lain yang umum dipakai pengguna (sudah dinormalisasi saat dipakai). */
const ALIASES: Record<string, string[]> = {
  "pantai-parangtritis": ["parangtritis", "parang tritis"],
  "pantai-indrayanti": ["indrayanti", "pulang syawal"],
  "pantai-baron": ["baron"],
  "pantai-glagah": ["glagah"],
  "gumuk-pasir-parangkusumo": ["parangkusumo", "gumuk pasir", "gumuk"],
  "gunung-api-purba-nglanggeran": ["nglanggeran", "gunung api purba", "api purba"],
  "hutan-pinus-mangunan": ["mangunan", "pinus mangunan", "hutan pinus"],
  kalibiru: ["kalibiru"],
  "keraton-yogyakarta": ["keraton", "kraton", "karaton"],
  "taman-sari": ["taman sari", "tamansari", "water castle"],
  "candi-prambanan": ["prambanan"],
  "candi-ratu-boko": ["ratu boko", "ratu baka", "boko"],
  "museum-benteng-vredeburg": ["vredeburg", "benteng vredeburg"],
  "museum-sonobudoyo": ["sonobudoyo", "sono budoyo"],
  "museum-affandi": ["affandi"],
  "museum-ullen-sentalu": ["ullen sentalu", "ulen sentalu", "ullen", "sentalu"],
  "desa-wisata-pentingsari": ["pentingsari"],
  "desa-wisata-brayut": ["brayut"],
  "desa-wisata-kasongan": ["kasongan"],
  "desa-wisata-tembi": ["tembi"],
};

function phrasesOf(entry: CatalogEntry): string[] {
  const full = normalize(entry.name);
  const significant = full
    .split(" ")
    .filter((token) => token && !GENERIC.has(token))
    .join(" ");
  const phrases = new Set<string>([full, ...(ALIASES[entry.slug] ?? []).map(normalize)]);
  if (significant.length >= 5) phrases.add(significant);
  return [...phrases].filter(Boolean);
}

/** Destinasi yang disebut dalam `text`, urut kemunculan. Kecocokan pasti didahulukan dari yang mirip. */
export function findMentions(text: string, catalog: CatalogEntry[]): Mention[] {
  const query = normalize(text);
  if (!query) return [];
  const padded = ` ${query} `;
  const tokens = query.split(" ");
  const found = new Map<string, Mention>();

  for (const entry of catalog) {
    const phrases = phrasesOf(entry);
    let best: Mention | null = null;

    for (const phrase of phrases) {
      const at = padded.indexOf(` ${phrase} `);
      if (at >= 0) {
        const index = at;
        if (!best || best.fuzzy || index < best.index) best = { slug: entry.slug, index, fuzzy: false };
      }
    }

    if (!best) {
      for (const phrase of phrases) {
        if (phrase.includes(" ") || phrase.length < 5) continue;
        const limit = phrase.length >= 8 ? 2 : 1;
        for (const [i, token] of tokens.entries()) {
          if (token.length < 4 || GENERIC.has(token)) continue;
          if (levenshtein(token, phrase, limit) <= limit) {
            const index = tokens.slice(0, i).join(" ").length;
            if (!best || index < best.index) best = { slug: entry.slug, index, fuzzy: true };
          }
        }
      }
    }
    if (best) found.set(entry.slug, best);
  }
  return [...found.values()].sort((a, b) => a.index - b.index);
}

/** Tempat terkenal di luar katalog 20 destinasi; dijawab jujur "belum ada", bukan dialihkan diam-diam. */
const KNOWN_OUTSIDE = [
  "borobudur", "malioboro", "tugu jogja", "tugu yogyakarta", "titik nol", "alun alun", "alun alun kidul", "kaliurang",
  "merapi", "pindul", "jomblang", "timang", "heha", "obelix", "bukit bintang", "gembira loka", "sindu kusuma",
  "kebun buah mangunan", "goa pindul", "air terjun sri gethuk", "mataram", "kotagede", "tebing breksi", "bukit paralayang",
];

const PLACE_PREFIX = /\b(pantai|candi|museum|desa wisata|gunung|bukit|air terjun|goa|gua|taman|kebun|waduk|curug|tebing)\s+([a-z]{3,})/g;
const NOT_A_NAME = new Set([
  "selatan", "utara", "barat", "timur", "yang", "mana", "apa", "apakah", "enak", "bagus", "sejuk", "cerah", "kalau", "saat",
  "buat", "untuk", "dekat", "terbaik", "populer", "tenang", "sepi", "ramai", "bersih", "indah", "dengan", "atau", "dan",
  "yg", "di", "ke", "dari", "pada", "sore", "pagi", "siang", "malam", "besok", "lusa", "hari", "jam", "pukul", "nanti",
  "sunset", "senja", "murah", "gratis", "aman", "boleh", "bisa", "tutup", "buka", "lain", "lainnya", "terdekat", "jogja",
  "yogyakarta", "diy", "wisata", "alam", "budaya", "sejarah", "kota",
]);

/** Nama tempat yang disebut tetapi tidak ada di katalog. */
export function findUnknownPlaces(text: string, mentions: Mention[], catalog: CatalogEntry[]): string[] {
  const query = normalize(text);
  const padded = ` ${query} `;
  const known = new Set<string>();

  for (const phrase of KNOWN_OUTSIDE) {
    if (padded.includes(` ${phrase} `)) {
      const insideCatalog = mentions.some((m) => {
        const entry = catalog.find((c) => c.slug === m.slug);
        return entry ? normalize(entry.name).includes(phrase) : false;
      });
      if (!insideCatalog) known.add(phrase);
    }
  }

  const mentionedNames = mentions
    .map((m) => catalog.find((c) => c.slug === m.slug))
    .filter((c): c is CatalogEntry => Boolean(c))
    .flatMap(phrasesOf);

  for (const match of query.matchAll(PLACE_PREFIX)) {
    const word = match[2];
    if (NOT_A_NAME.has(word)) continue;
    const covered = mentionedNames.some((phrase) => phrase.split(" ").includes(word));
    if (!covered) known.add(`${match[1]} ${word}`);
  }
  const names = [...known].map((name) => name.replace(/\b\w/g, (c) => c.toUpperCase()));
  // Buang nama yang hanya bagian dari nama lain ("Borobudur" di dalam "Candi Borobudur").
  return names.filter((name) => !names.some((other) => other !== name && other.toLowerCase().includes(name.toLowerCase())));
}

/** Tiga destinasi katalog yang namanya paling mirip dengan teks (untuk "maksud Anda ...?"). */
export function closestNames(text: string, catalog: CatalogEntry[], limit = 3): CatalogEntry[] {
  const query = normalize(text);
  return [...catalog]
    .map((entry) => {
      const phrases = phrasesOf(entry);
      const score = Math.max(...phrases.map((phrase) => dice(query, phrase)), dice(query, normalize(entry.name)));
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, "id"))
    .slice(0, limit)
    .map((item) => item.entry);
}
