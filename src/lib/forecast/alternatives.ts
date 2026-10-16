// F5. Alternatif saat cuaca buruk (Rancangan Teknis, "Alternatif saat cuaca buruk").
//
// Dipicu bila skor slot < 50 DAN penalti terbesarnya hujan. Sistem mencari
// destinasi is_indoor dalam radius 15 km yang BUKA pada slot itu dan berskor
// minimal 60, terdekat dulu, maksimal 3. Bila tidak ada, sarankan slot lain
// di destinasi yang sama dengan skor tertinggi.

import type { DestCategory } from "../categories";
import { getScoreProfiles, indoorCandidates, type Destination } from "../db/destinations";
import type { ScoreProfile } from "../scoring/score";
import { getRegionForecast } from "../weather/service";
import { warnUnknownWeather } from "./destination-forecast";
import { bestOverlappingSlot, scoreSlots, type ScoredSlot } from "./slots";

export const ALT_RADIUS_M = 15_000;
export const ALT_MIN_SCORE = 60;
export const ALT_TRIGGER_BELOW = 50;
export const ALT_MAX = 3;

export type Alternative = {
  slug: string;
  name: string;
  category: DestCategory;
  distanceM: number;
  score: number;
  label: ScoredSlot["label"];
  band: ScoredSlot["band"];
};

export function isAlternativeTrigger(slot: Pick<ScoredSlot, "score" | "dominant">): boolean {
  return (
    slot.score !== null &&
    slot.score < ALT_TRIGGER_BELOW &&
    (slot.dominant === "rain" || slot.dominant === "heat")
  );
}

/** Slot lain di destinasi yang sama dengan skor tertinggi (seri: paling awal), hanya bila lebih baik. */
export function bestOtherSlot(slots: ScoredSlot[], current: ScoredSlot): ScoredSlot | null {
  let best: ScoredSlot | null = null;
  for (const slot of slots) {
    if (slot.validAt === current.validAt || slot.score === null) continue;
    if (best === null || slot.score > (best.score as number)) best = slot;
  }
  return best && best.score !== null && current.score !== null && best.score > current.score ? best : null;
}

/**
 * Alternatif untuk setiap slot terpicu, kunci = validAt slot. Slot yang tidak
 * terpicu tidak muncul di Map. Kandidat dan prakiraannya dibaca sekali.
 */
export async function alternativesBySlot(
  destination: Destination,
  slots: ScoredSlot[],
  now: Date,
  profilesIn?: Record<DestCategory, ScoreProfile>,
): Promise<Map<string, Alternative[]>> {
  const result = new Map<string, Alternative[]>();
  const triggered = slots.filter(isAlternativeTrigger);
  if (triggered.length === 0) return result;

  const [candidates, profiles] = await Promise.all([
    indoorCandidates(destination.id, ALT_RADIUS_M),
    profilesIn ?? getScoreProfiles(),
  ]);

  const scoredCandidates = await Promise.all(
    candidates.map(async (candidate) => {
      const region = await getRegionForecast(candidate.adm4Code, { now });
      const profile = profiles[candidate.category];
      const scored = profile
        ? scoreSlots(region.rows, candidate, profile, { onUnknownWeather: warnUnknownWeather })
        : [];
      return { candidate, scored };
    }),
  );

  for (const slot of triggered) {
    const list: Alternative[] = [];
    for (const { candidate, scored } of scoredCandidates) {
      // Grid jam BMKG bisa bergeser antar-wilayah, jadi cocokkan lewat irisan waktu terbesar.
      const there = bestOverlappingSlot(scored, new Date(slot.validAt).getTime());
      if (!there || !there.isOpen || there.score === null || there.score < ALT_MIN_SCORE) continue;
      list.push({
        slug: candidate.slug,
        name: candidate.name,
        category: candidate.category,
        distanceM: candidate.distanceM,
        score: there.score,
        label: there.label,
        band: there.band,
      });
    }
    list.sort((a, b) => a.distanceM - b.distanceM || b.score - a.score || a.slug.localeCompare(b.slug));
    result.set(slot.validAt, list.slice(0, ALT_MAX));
  }
  return result;
}
