// Menggabungkan hasil pemahaman model (bila ada) dengan deteksi deterministik.
// Aturan: hal yang pasti (waktu, nama destinasi, topik tak didukung, di luar topik) ditentukan
// kode; model hanya mengisi celah dan menafsirkan kalimat yang sulit.

import type { DestCategory } from "../categories";
import {
  detectCategories,
  detectGreeting,
  detectIntent,
  detectOrdinal,
  detectPreferences,
  detectTopics,
  refersToPrevious,
  type AssistantIntent,
  type Preference,
  type Topic,
  type UnsupportedKind,
} from "./intent";
import { closestNames, findMentions, findUnknownPlaces, type CatalogEntry } from "./resolver";
import { normalize } from "./text";
import { parseWhen, type ParsedWhen, type Part } from "./when";

/** Keluaran model yang sudah divalidasi. Semua bidang opsional. */
export type ModelUnderstanding = {
  intent?: AssistantIntent;
  when?: { dayOffset?: number | null; hour?: number | null; part?: Part | null };
  destinationRefs?: string[];
  categories?: DestCategory[];
  preferences?: Preference[];
  topics?: Topic[];
  days?: number;
};

export type Understanding = {
  intent: AssistantIntent;
  unsupported: UnsupportedKind | null;
  when: ParsedWhen;
  slugs: string[];
  unknownPlaces: string[];
  ambiguousReference: boolean;
  categories: DestCategory[];
  preferences: Preference[];
  topics: Topic[];
  days: number;
};

export type UnderstandContext = {
  now: Date;
  catalog: CatalogEntry[];
  /** Slug hasil jawaban sebelumnya (maks. 3), untuk pertanyaan lanjutan. */
  focus: string[];
};

const union = <T>(...lists: (T[] | undefined)[]): T[] => [...new Set(lists.flatMap((l) => l ?? []))];

function parseDays(query: string): number {
  const match = normalize(query).match(/\b(\d+|dua|tiga|empat|lima) (hari|malam)\b/);
  if (!match) return 1;
  const words: Record<string, number> = { dua: 2, tiga: 3, empat: 4, lima: 5 };
  const n = words[match[1]] ?? Number(match[1]);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 14) : 1;
}

export function mergeUnderstanding(query: string, ctx: UnderstandContext, model: ModelUnderstanding | null): Understanding {
  const validSlugs = new Set(ctx.catalog.map((c) => c.slug));

  // ---- destinasi yang disebut
  const mentions = findMentions(query, ctx.catalog);
  let slugs = mentions.map((m) => m.slug);
  if (slugs.length === 0 && model?.destinationRefs) slugs = model.destinationRefs.filter((s) => validSlugs.has(s)).slice(0, 3);
  const unknownPlaces = findUnknownPlaces(query, mentions, ctx.catalog);

  // ---- rujukan ke hasil sebelumnya ("yang kedua", "itu", "bandingkan keduanya")
  let ambiguousReference = false;
  const focus = ctx.focus.filter((s) => validSlugs.has(s)).slice(0, 3);
  // Pertanyaan topik spesifik tanpa nama ("harga per orangnya berapa?") juga merujuk hasil sebelumnya.
  const aboutOneThing = detectTopics(query).some((t) => ["lokasi", "jam_buka", "tiket", "fasilitas", "tips", "jarak"].includes(t));
  if (slugs.length === 0 && focus.length > 0 && (refersToPrevious(query) || aboutOneThing)) {
    const ordinal = detectOrdinal(query);
    if (ordinal !== null && focus[ordinal]) slugs = [focus[ordinal]];
    else if (/\b(kedua|ketiga|semua|keduanya|ketiganya|semuanya|bandingkan)\b/.test(normalize(query)) && focus.length >= 2) slugs = focus;
    else if (focus.length === 1) slugs = [focus[0]];
    else ambiguousReference = true;
  }

  // ---- maksud
  const det = detectIntent(query, slugs.length, focus.length > 0);
  const preferences = union<Preference>(detectPreferences(query), model?.preferences);
  const categories = union<DestCategory>(detectCategories(query), model?.categories);
  let topics = detectTopics(query);
  if (topics.length === 0 && model?.topics) topics = union<Topic>(model.topics);

  let intent: AssistantIntent = det.intent;
  const decisive: AssistantIntent[] = ["unsupported", "out_of_scope", "itinerary", "compare", "info", "explain", "app_help", "alternative"];
  if (!decisive.includes(det.intent) && !detectGreeting(query) && model?.intent) {
    intent = model.intent;
    // Model tidak boleh menyatakan di luar topik bila kalimat jelas bertema wisata.
    const touristic = slugs.length > 0 || preferences.length > 0 || categories.length > 0 || topics.length > 0;
    if (intent === "out_of_scope" && touristic) intent = det.intent;
    if (intent === "unsupported" && !det.unsupported) intent = "clarify";
  }
  if (intent === "info" && topics.length === 0 && slugs.length === 0) intent = "clarify";

  // ---- waktu
  const when = parseWhen(query, ctx.now);
  if (model?.when) {
    if (when.dayOffset === null && !when.beyond) {
      const offset = model.when.dayOffset;
      if (typeof offset === "number") {
        if (offset >= 0 && offset <= 2) when.dayOffset = offset;
        else if (offset > 2) when.beyond = `${offset} hari lagi`;
      }
    }
    if (when.hour === null && typeof model.when.hour === "number" && model.when.hour >= 0 && model.when.hour <= 23) {
      when.hour = model.when.hour;
    }
    if (when.part === null && model.when.part) when.part = model.when.part;
  }

  return {
    intent,
    unsupported: det.unsupported,
    when,
    slugs,
    unknownPlaces,
    ambiguousReference,
    categories,
    preferences,
    topics,
    days: Math.max(parseDays(query), model?.days ?? 1),
  };
}

/** Daftar nama destinasi terdekat untuk pesan "maksud Anda". Dipakai ulang oleh route bila perlu. */
export { closestNames };
