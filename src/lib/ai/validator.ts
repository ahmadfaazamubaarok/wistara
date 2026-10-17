// Validator keluaran model. Model hanya boleh merapikan kalimat; angka dan nama destinasi
// harus berasal dari fakta yang diberikan mesin. Bila tidak, jawaban model dibuang dan
// jawaban deterministik dipakai.

import { findMentions, type CatalogEntry } from "./resolver";

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export type ValidationContext = {
  /** Seluruh teks yang boleh menjadi sumber angka: jawaban dasar, fakta, dan pertanyaan pengguna. */
  allowedText: string;
  catalog: CatalogEntry[];
  /** Destinasi yang boleh disebut dalam jawaban. */
  allowedSlugs: string[];
};

const MAX_LENGTH = 1500;
const MIN_LENGTH = 15;

function digitGroups(text: string): Set<string> {
  return new Set(text.match(/\d+/g) ?? []);
}

/** Cocok dengan angka tanpa nol di depan, supaya "06" dan "6" dianggap sama. */
const canonical = (group: string) => String(Number(group));

export function validateReply(reply: string, context: ValidationContext): ValidationResult {
  const text = reply.trim();
  if (text.length < MIN_LENGTH) return { ok: false, reason: "terlalu pendek" };
  if (text.length > MAX_LENGTH) return { ok: false, reason: "terlalu panjang" };
  if (/https?:\/\/|www\.|```|<\/?[a-z][^>]*>/i.test(text)) return { ok: false, reason: "memuat tautan atau markup" };

  const allowed = new Set([...digitGroups(context.allowedText)].map(canonical));
  for (const group of digitGroups(text)) {
    if (!allowed.has(canonical(group))) return { ok: false, reason: `angka ${group} tidak ada di fakta` };
  }

  const allowedSlugs = new Set(context.allowedSlugs);
  for (const mention of findMentions(text, context.catalog)) {
    if (!mention.fuzzy && !allowedSlugs.has(mention.slug)) {
      return { ok: false, reason: `menyebut destinasi di luar fakta (${mention.slug})` };
    }
  }
  return { ok: true };
}
