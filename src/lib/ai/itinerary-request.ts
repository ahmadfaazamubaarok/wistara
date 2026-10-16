// Rencana yang disusun menurut permintaan pengguna ("pertama keraton pas siang, trus pantai glagah sore,
// terakhir taman sari pas malam"). Urutan, nama, dan waktu yang disebut dipakai apa adanya; setiap
// destinasi divalidasi (buka? ada prakiraan? skor?) dan bila tidak cocok dikatakan terus terang,
// lalu dipindah ke slot terdekat yang buka atau dikeluarkan.

import type { EngineDestination } from "./engine";
import { estimateTransitMinutes, haversineDistanceKm, type ItineraryPlan, type PlannedSlotItem } from "./itinerary-planner";
import { findMentions, type CatalogEntry } from "./resolver";
import { PART_RANGE, parseWhen, pickSlot, type Part } from "./when";
import type { ScoredSlot } from "../forecast/slots";

export type ItineraryRequest = { slug: string; hour: number | null; part: Part | null };

/** Pemisah antar-langkah dalam kalimat: koma, "trus", "lalu", "yang terakhir", dan sebagainya. */
const STEP_SPLIT =
  /[,;]|\b(?:trus|terus|lalu|kemudian|habis itu|abis itu|setelah itu|sesudah itu|lanjut|baru)\b|\byang (?:pertama|kedua|ketiga|keempat|terakhir|selanjutnya|berikutnya)\b/gi;

/** Destinasi (dan waktunya bila disebut) per langkah, menurut urutan penyebutan. */
export function extractItineraryRequests(query: string, catalog: CatalogEntry[], now: Date): ItineraryRequest[] {
  const found: ItineraryRequest[] = [];
  const seen = new Set<string>();
  for (const clause of query.split(STEP_SPLIT)) {
    if (!clause) continue;
    const mentions = findMentions(clause, catalog);
    if (mentions.length === 0) continue;
    const when = parseWhen(clause, now);
    mentions.forEach((mention, i) => {
      if (seen.has(mention.slug)) return;
      seen.add(mention.slug);
      // Waktu pada satu klausa dipasangkan dengan destinasi pertamanya.
      found.push({ slug: mention.slug, hour: i === 0 ? when.hour : null, part: i === 0 ? when.part : null });
    });
  }
  return found;
}

const PART_TARGET_HOUR: Record<Part, number> = { pagi: 8, siang: 12, sore: 16, malam: 19 };
const PART_TITLE: Record<Part, string> = { pagi: "Pagi", siang: "Siang", sore: "Sore", malam: "Malam" };

export function partOfSlot(slot: ScoredSlot): Part {
  const hour = Number(slot.localTime.slice(11, 13));
  for (const part of ["pagi", "siang", "sore", "malam"] as Part[]) {
    const [from, to] = PART_RANGE[part];
    if (hour >= from && hour < to) return part;
  }
  return "pagi";
}

export type RequestedPlanHelpers = {
  hoursText: (dest: EngineDestination) => string;
  slotRange: (slot: ScoredSlot) => string;
  slotPhrase: (slot: ScoredSlot) => string;
};

export type RequestedPlanResult = {
  plan: ItineraryPlan | null;
  /** Kalimat penyesuaian untuk pengguna (dipindah, dikeluarkan, skor rendah). */
  adjustments: string[];
};

const askedLabel = (request: ItineraryRequest) =>
  request.hour !== null ? `pukul ${String(request.hour).padStart(2, "0")}.00` : request.part ? `waktu ${request.part}` : "waktu itu";

export function planRequestedItinerary(
  items: EngineDestination[],
  requests: ItineraryRequest[],
  dayKey: string,
  dayLabel: string,
  now: Date,
  helpers: RequestedPlanHelpers,
): RequestedPlanResult {
  const adjustments: string[] = [];
  const used = new Set<number>();
  const placed: { dest: EngineDestination; slot: ScoredSlot; asked: ItineraryRequest }[] = [];
  const startOf = (slot: ScoredSlot) => new Date(slot.validAt).getTime();

  const openFree = (dest: EngineDestination) =>
    dest.slots.filter(
      (s) =>
        s.localTime.startsWith(dayKey) &&
        s.isOpen &&
        s.score !== null &&
        startOf(s) + 3 * 3_600_000 > now.getTime() &&
        !used.has(startOf(s)),
    );

  for (const request of requests) {
    const dest = items.find((d) => d.slug === request.slug);
    if (!dest) continue;
    let slot: ScoredSlot | null = null;

    if (request.hour === null && request.part === null) {
      // Tanpa waktu: slot buka terbaik setelah langkah sebelumnya, agar urutan tetap masuk akal.
      const lastStart = placed.length > 0 ? Math.max(...placed.map((p) => startOf(p.slot))) : 0;
      const candidates = openFree(dest);
      const later = candidates.filter((s) => startOf(s) > lastStart);
      const pool = later.length > 0 ? later : candidates;
      slot = pool.reduce<ScoredSlot | null>((best, s) => (!best || (s.score as number) > (best.score as number) ? s : best), null);
      if (!slot) adjustments.push(`${dest.name} tidak bisa dimasukkan karena tidak ada slot buka dengan prakiraan pada hari itu.`);
    } else {
      const pick = pickSlot(dest.slots, dayKey, { hour: request.hour, part: request.part }, now);
      if (pick.status === "ok" && pick.slot && !used.has(startOf(pick.slot))) {
        slot = pick.slot;
      } else {
        const why =
          pick.status === "closed"
            ? `${dest.name} tutup pada ${askedLabel(request)} (jam buka: ${helpers.hoursText(dest)})`
            : pick.status === "past"
              ? `${askedLabel(request)} untuk ${dest.name} sudah lewat`
              : pick.status === "no_forecast"
                ? `prakiraan ${dest.name} untuk ${askedLabel(request)} belum tersedia`
                : `${askedLabel(request)} sudah dipakai destinasi lain`;
        const target = request.hour ?? PART_TARGET_HOUR[request.part as Part];
        const alternative = openFree(dest).sort(
          (a, b) =>
            Math.abs(Number(a.localTime.slice(11, 13)) - target) - Math.abs(Number(b.localTime.slice(11, 13)) - target),
        )[0];
        if (alternative) {
          slot = alternative;
          adjustments.push(`${why}, jadi saya pindahkan ke ${helpers.slotPhrase(alternative)} saat masih buka.`);
        } else {
          adjustments.push(`${why}, dan tidak ada slot lain yang buka pada hari itu, jadi tidak saya masukkan ke rencana.`);
        }
      }
    }
    if (slot) {
      used.add(startOf(slot));
      placed.push({ dest, slot, asked: request });
    }
  }

  if (placed.length === 0) return { plan: null, adjustments };
  placed.sort((a, b) => startOf(a.slot) - startOf(b.slot));

  const slots: PlannedSlotItem[] = placed.map(({ dest, slot, asked }, index) => {
    const part = partOfSlot(slot);
    const score = slot.score as number;
    const notes = [asked.hour !== null || asked.part !== null ? "Sesuai permintaan Anda." : "Dipilih pada slot terbaiknya."];
    if (score < 50) notes.push(`Skor kurang sesuai (${score}).`);
    if (dest.alert) notes.push("Ada peringatan dini cuaca BMKG di wilayah ini.");
    if (slot.reasons[0]) notes.push(slot.reasons[0]);

    const previous = placed[index - 1]?.dest;
    const distanceKm = previous ? haversineDistanceKm(previous.lat, previous.lon, dest.lat, dest.lon) : 0;
    const minutes = previous ? estimateTransitMinutes(distanceKm) : 0;
    return {
      part,
      timeLabel: `${PART_TITLE[part]} (${helpers.slotRange(slot)} WIB)`,
      destination: {
        slug: dest.slug,
        name: dest.name,
        category: dest.category,
        kabupaten: dest.region.kabupaten,
        lat: dest.lat,
        lon: dest.lon,
        score,
        weatherDesc: slot.weatherDesc ?? "Cuaca terdata",
        temp: Math.round(slot.t ?? 0),
        isIndoor: dest.isIndoor,
      },
      notes: notes.join(" "),
      ...(previous ? { transitFromPrevious: { distanceKm, estimatedMinutes: minutes, isFar: minutes > 60 } } : {}),
    };
  });

  const notices: string[] = [];
  if (slots.some((s) => s.transitFromPrevious?.isFar)) {
    notices.push("Salah satu perpindahan membutuhkan perjalanan darat lebih dari 60 menit; disarankan berangkat tepat waktu.");
  }
  return {
    plan: {
      title: `Rencana Pilihan Anda (${dayLabel})`,
      dayKey,
      dayLabel,
      averageScore: Math.round(slots.reduce((sum, s) => sum + s.destination.score, 0) / slots.length),
      slots,
      notices,
    },
    adjustments,
  };
}
