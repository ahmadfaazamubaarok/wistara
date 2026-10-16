// Utilitas teks murni untuk asisten: normalisasi, jarak edit, dan kemiripan.

/** Huruf kecil, tanpa diakritik dan tanda baca; spasi dirapatkan. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Jarak Levenshtein dengan batas atas (berhenti dini bila sudah melebihi `max`). */
export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function bigrams(text: string): Map<string, number> {
  const map = new Map<string, number>();
  const padded = ` ${text} `;
  for (let i = 0; i < padded.length - 1; i += 1) {
    const gram = padded.slice(i, i + 2);
    map.set(gram, (map.get(gram) ?? 0) + 1);
  }
  return map;
}

/** Koefisien Dice atas bigram huruf, 0..1. */
export function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  const left = bigrams(a);
  const right = bigrams(b);
  let overlap = 0;
  let total = 0;
  for (const count of left.values()) total += count;
  for (const count of right.values()) total += count;
  for (const [gram, count] of left) overlap += Math.min(count, right.get(gram) ?? 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
