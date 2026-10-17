// Mesin jawaban deterministik Wistara AI. Semua keputusan (destinasi, slot, skor, jam, jarak)
// dibuat di sini dari data sistem. Model bahasa hanya boleh merapikan kalimat dari hasil ini.
//
// Prinsip: bila data tidak ada, mesin berkata jujur dan sopan ("belum tercatat di sistem kami"),
// tidak menebak destinasi lain dan tidak mengarang angka.

import type { DestCategory } from "../categories";
import { FACILITY_LABEL, type FacilityType } from "../categories";
import type { Destination, NearbyFacility } from "../db/destinations";
import type { WeatherAlert } from "../db/alerts";
import type { DestinationEnrichment } from "../destination-enrichment";
import type { Alternative } from "../forecast/alternatives";
import { SLOT_HOURS, upcomingSlots, type ScoredSlot } from "../forecast/slots";
import { summarizeOpenHours } from "../format";
import { DEFAULT_VISIT_WINDOW } from "../scoring/open-hours";
import { getWibDateKey } from "../wib";
import { type DestinationAttribute } from "./attributes";
import type { AssistantIntent, Preference, Topic, UnsupportedKind } from "./intent";
import { planItinerary, type ItineraryPlan } from "./itinerary-planner";
import { planRequestedItinerary, type ItineraryRequest } from "./itinerary-request";
import { closestNames } from "./resolver";
import { describeWhen, pickSlot, type ParsedWhen, type SlotPick } from "./when";

export type EngineDestination = Destination & {
  slots: ScoredSlot[];
  enrichment?: DestinationEnrichment;
  attr: DestinationAttribute;
  alert: WeatherAlert | null;
};

export type AssistantCard = {
  slug: string;
  name: string;
  category: DestCategory;
  kabupaten: string;
  score: number | null;
  weatherDesc: string | null;
  temp: number | null;
  isOpen: boolean;
  ticketPrice?: string;
  reasons: string[];
  /** Slot yang dinilai, mis. "Besok, pukul 12.00 WIB". */
  slotLabel?: string;
  openHours?: string;
  hoursVerified?: boolean;
  details?: string[];
};

export type EngineInput = {
  now: Date;
  query: string;
  intent: AssistantIntent;
  unsupported: UnsupportedKind | null;
  when: ParsedWhen;
  /** Slug destinasi yang dirujuk (sudah termasuk rujukan ke hasil sebelumnya). */
  slugs: string[];
  /** Nama tempat yang disebut tetapi tidak ada di katalog. */
  unknownPlaces: string[];
  /** Pengguna merujuk hasil sebelumnya yang ambigu atau tidak tersedia. */
  ambiguousReference: boolean;
  categories: DestCategory[];
  preferences: Preference[];
  topics: Topic[];
  days: number;
  /** Destinasi dan waktu yang diminta pengguna untuk rencana ("pertama keraton pas siang, ..."). */
  requests?: ItineraryRequest[];
  isLoggedIn: boolean;
  items: EngineDestination[];
  fetchFacilities?: (destination: EngineDestination) => Promise<NearbyFacility[]>;
  fetchAlternatives?: (destination: EngineDestination, slot: ScoredSlot) => Promise<Alternative[]>;
};

export type EngineResult = {
  type: AssistantIntent;
  cards: AssistantCard[];
  itinerary: ItineraryPlan | null;
  notices: string[];
  /** Data yang diminta tetapi tidak tersedia; ditulis apa adanya di jawaban. */
  unavailable: string[];
  /** Jawaban deterministik lengkap. Dipakai langsung, atau sebagai bahan untuk dirapikan model. */
  baseReply: string;
  /** Boleh dirapikan model (jawaban penolakan dan data-hilang selalu dipakai apa adanya). */
  allowRewrite: boolean;
  suggestions: string[];
  focus: string[];
};

const DAY_NAMES = ["Hari ini", "Besok", "Lusa"];
const dotted = (hhmm: string) => hhmm.replace(":", ".");

/* ----------------------------- bantuan format ----------------------------- */

function dayOffsetOf(when: ParsedWhen, fallback = 0): number {
  return when.dayOffset ?? fallback;
}

/** Jam mulai–selesai slot 3 jam, mis. "11.00–14.00". */
function slotRange(slot: ScoredSlot): string {
  const start = slot.localTime.slice(11, 16);
  const endHour = (Number(start.slice(0, 2)) + SLOT_HOURS) % 24;
  return `${start.replace(":", ".")}–${String(endHour).padStart(2, "0")}.${start.slice(3, 5)}`;
}

function slotLabelOf(slot: ScoredSlot, dayOffset: number): string {
  return `${DAY_NAMES[dayOffset] ?? "Hari ini"}, pukul ${slotRange(slot)} WIB`;
}

/** Untuk di dalam kalimat: "besok pukul 11.00–14.00 WIB". */
function slotPhrase(slot: ScoredSlot, dayOffset: number): string {
  return `${(DAY_NAMES[dayOffset] ?? "Hari ini").toLowerCase()} pukul ${slotRange(slot)} WIB`;
}

export function openHoursText(dest: EngineDestination): { text: string; short: string; verified: boolean } {
  const verified = dest.verifiedAt !== null;
  if (dest.openHours) {
    const lines = summarizeOpenHours(dest.openHours as Record<string, [string, string]>);
    return { text: lines.join("; "), short: lines.join("; "), verified };
  }
  const [from, to] = DEFAULT_VISIT_WINDOW;
  return {
    text: `tidak ada jam buka tetap di data kami (penilaian memakai jendela kunjungan ${dotted(from)}–${dotted(to)} WIB)`,
    short: `belum tercatat (dinilai ${dotted(from)}–${dotted(to)} WIB)`,
    verified,
  };
}

function verificationNote(dest: EngineDestination): string {
  return dest.verifiedAt === null
    ? "Jam ini belum diverifikasi ke pengelola, jadi cek informasi resmi sebelum berangkat."
    : `Terakhir diverifikasi ${dest.verifiedAt}.`;
}

function toCard(dest: EngineDestination, slot: ScoredSlot | null, dayOffset: number, extra: Partial<AssistantCard> = {}): AssistantCard {
  const hours = openHoursText(dest);
  return {
    slug: dest.slug,
    name: dest.name,
    category: dest.category,
    kabupaten: dest.region.kabupaten,
    score: slot && slot.isOpen ? slot.score : null,
    weatherDesc: slot?.weatherDesc ?? null,
    temp: slot?.t !== null && slot?.t !== undefined ? Math.round(slot.t) : null,
    isOpen: slot ? slot.isOpen && slot.score !== null : false,
    ticketPrice: dest.enrichment?.ticketPrice.domestic,
    reasons: slot?.reasons.slice(0, 2) ?? [],
    slotLabel: slot ? slotLabelOf(slot, dayOffset) : undefined,
    openHours: hours.short,
    hoursVerified: hours.verified,
    ...extra,
  };
}

function ticketToNumber(price: string | undefined): number | null {
  if (!price) return null;
  if (/gratis|bebas biaya|tanpa biaya/i.test(price)) return 0;
  const match = price.match(/Rp\s*([\d.]+)/i);
  return match ? Number(match[1].replace(/\./g, "")) : null;
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} dan ${names[names.length - 1]}`;

function nextOpenSlot(items: EngineDestination[], now: Date): { dest: EngineDestination; slot: ScoredSlot } | null {
  let best: { dest: EngineDestination; slot: ScoredSlot } | null = null;
  for (const dest of items) {
    for (const slot of upcomingSlots(dest.slots, now)) {
      if (!slot.isOpen || slot.score === null) continue;
      if (!best || new Date(slot.validAt) < new Date(best.slot.validAt)) best = { dest, slot };
    }
  }
  return best;
}

function dayOffsetOfSlot(slot: ScoredSlot, now: Date): number {
  const keys = [0, 1, 2].map((i) => getWibDateKey(new Date(now.getTime() + i * 86_400_000)));
  return Math.max(0, keys.indexOf(slot.localTime.slice(0, 10)));
}

function emptyResult(type: AssistantIntent, reply: string, extra: Partial<EngineResult> = {}): EngineResult {
  return {
    type,
    cards: [],
    itinerary: null,
    notices: [],
    unavailable: [],
    baseReply: reply,
    allowRewrite: false,
    suggestions: [],
    focus: [],
    ...extra,
  };
}

const CAPABILITY_SUGGESTIONS = [
  "Besok pagi enaknya ke mana?",
  "Rencana 1 hari untuk besok",
  "Tempat sejuk saat siang terik",
  "Kalau hujan ke mana?",
];

/* ------------------------------ penolakan sopan ------------------------------ */

const UNSUPPORTED_REPLY: Record<UnsupportedKind, string> = {
  gelombang:
    "Maaf, kami belum memiliki data tinggi gelombang, arus, atau kelayakan berenang di sistem, jadi saya tidak bisa menyatakan aman atau tidaknya. Untuk aktivitas di pantai, ikuti rambu dan arahan petugas di lokasi serta imbauan resmi BMKG.",
  penginapan: "Maaf, data penginapan belum ada di sistem kami. Wistara saat ini fokus pada waktu terbaik berkunjung, cuaca, dan fasilitas di sekitar 20 destinasi.",
  transportasi:
    "Untuk rute kendaraan umum di Yogyakarta, Anda dapat memanfaatkan bus Trans Jogja (tarif Rp 3.600 non-tunai), KRL Commuter Line Yogya–Solo (Stasiun Tugu, Lempuyangan, Maguwo, Brambanan), dan KA Bandara YIA. Pada tiap halaman detail destinasi di Wistara, Anda dapat melihat halte/stasiun terdekat dan langsung mengeklik opsi 'Rute Kendaraan Umum' untuk panduan transit lengkap di Google Maps.",
  keramaian: "Maaf, kami belum memiliki data keramaian atau kepadatan pengunjung, jadi saya tidak bisa memperkirakannya. Yang bisa saya bantu adalah kondisi cuaca dan skor kenyamanan per jam.",
  kuliner:
    "Maaf, rekomendasi kuliner belum ada di sistem kami. Untuk tiap destinasi saya hanya bisa menyebut jumlah tempat makan di sekitarnya (data OpenStreetMap), tanpa penilaian rasa.",
  lainnya: "Maaf, data itu belum ada di sistem kami.",
};

function unsupportedResult(kind: UnsupportedKind): EngineResult {
  return emptyResult("unsupported", UNSUPPORTED_REPLY[kind], {
    unavailable: [kind],
    suggestions: CAPABILITY_SUGGESTIONS.slice(0, 3),
  });
}

/* --------------------------------- penyelesaian -------------------------------- */

function ask(items: EngineDestination[], input: EngineInput, text: string, prefix = ""): EngineResult {
  const near = closestNames(input.query, items.map((d) => ({ slug: d.slug, name: d.name })));
  const names = near.map((n) => n.name);
  return emptyResult(
    input.intent,
    `${prefix}${text} Misalnya: ${joinNames(names)}.`.replace("  ", " "),
    { suggestions: names.map((n) => `Info ${n}`) },
  );
}

function pastOrBeyond(input: EngineInput): EngineResult | null {
  if (input.when.beyond) {
    return emptyResult(
      input.intent,
      `Maaf, prakiraan BMKG yang kami miliki hanya 3 hari ke depan (hari ini, besok, dan lusa), jadi saya belum bisa menjawab untuk ${input.when.beyond}. Silakan tanyakan lagi untuk salah satu dari tiga hari itu.`,
      { unavailable: ["prakiraan di luar 3 hari"], suggestions: ["Rekomendasi untuk besok", "Rencana 1 hari untuk lusa"] },
    );
  }
  return null;
}

/* ---------------------------------- cabang ---------------------------------- */

function recommend(input: EngineInput): EngineResult {
  const { items, when, preferences, categories, now } = input;
  const dayOffset = dayOffsetOf(when);
  const dayKey = getWibDateKey(new Date(now.getTime() + dayOffset * 86_400_000));
  const notices: string[] = [];

  let pool = items.filter((d) => !d.alert);
  for (const d of items.filter((x) => x.alert)) notices.push(`${d.name} tidak disarankan karena ada peringatan dini cuaca BMKG di wilayahnya.`);

  if (categories.length > 0) {
    const filtered = pool.filter((d) => categories.includes(d.category));
    if (filtered.length > 0) pool = filtered;
  }

  const must = (d: EngineDestination) => {
    if (preferences.includes("teduh") || preferences.includes("hujan")) {
      if (!(d.isIndoor || d.attr.isShadedOrIndoor)) return false;
    }
    if (preferences.includes("sunset") && !d.attr.isSunsetSpot) return false;
    return true;
  };
  let strict = pool.filter(must);
  if (strict.length === 0 && pool.length > 0 && preferences.length > 0) {
    notices.push("Tidak ada destinasi yang memenuhi semua kriteria yang Anda sebut pada waktu itu; yang ditampilkan adalah pilihan terbaik berikutnya.");
    strict = pool;
  }
  pool = strict;

  const picks = pool.map((dest) => ({ dest, pick: pickSlot(dest.slots, dayKey, when, now) }));
  const open = picks.filter((p): p is { dest: EngineDestination; pick: SlotPick & { slot: ScoredSlot } } => p.pick.status === "ok" && p.pick.slot !== null);

  if (open.length === 0) {
    const when_ = describeWhen(when, dayOffset);
    const noForecast = picks.length > 0 && picks.every((p) => p.pick.status === "no_forecast");
    if (noForecast) {
      return emptyResult("recommend", `Maaf, prakiraan untuk ${when_} belum tersedia di sistem kami.`, { unavailable: ["prakiraan"] });
    }
    const allPast = picks.length > 0 && picks.every((p) => p.pick.status === "past");
    const next = nextOpenSlot(pool.length > 0 ? pool : items, now);
    const nextText = next
      ? ` Slot buka terdekat: ${slotPhrase(next.slot, dayOffsetOfSlot(next.slot, now))} (misalnya ${next.dest.name}).`
      : "";
    return emptyResult(
      "recommend",
      allPast
        ? `Waktu itu sudah lewat, jadi tidak ada yang bisa direkomendasikan.${nextText}`
        : `Pada ${when_} semua destinasi di katalog kami tutup, jadi saya tidak bisa merekomendasikan satu pun.${nextText}`,
      { notices, suggestions: ["Rekomendasi untuk besok pagi", "Rencana 1 hari untuk besok"] },
    );
  }

  const cheap = preferences.includes("murah");
  open.sort((a, b) => {
    if (cheap) {
      const pa = ticketToNumber(a.dest.enrichment?.ticketPrice.domestic) ?? Number.MAX_SAFE_INTEGER;
      const pb = ticketToNumber(b.dest.enrichment?.ticketPrice.domestic) ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
    }
    return rankScore(b.dest, b.pick.slot, preferences) - rankScore(a.dest, a.pick.slot, preferences) || a.dest.name.localeCompare(b.dest.name, "id");
  });

  const top = open.slice(0, 3);
  const cards = top.map(({ dest, pick }) => {
    const reasons = [...pick.slot.reasons.slice(0, 1)];
    if ((preferences.includes("teduh") || preferences.includes("hujan")) && (dest.isIndoor || dest.attr.isShadedOrIndoor)) {
      reasons.push("Terlindung dari terik dan hujan (tercatat sebagai ruang tertutup atau teduh).");
    }
    if (preferences.includes("sunset") && dest.attr.isSunsetSpot) reasons.push("Dikenal sebagai titik melihat matahari terbenam.");
    if (preferences.includes("keluarga") && dest.enrichment?.tags.includes("Keluarga")) reasons.push("Ditandai ramah untuk keluarga.");
    return toCard(dest, pick.slot, dayOffset, { reasons: reasons.slice(0, 2) });
  });

  if (preferences.includes("keluarga")) {
    notices.push("Data khusus ramah balita atau akses kursi roda belum ada di sistem kami; pilihan di atas hanya berdasarkan skor cuaca, ruang teduh, dan tag keluarga.");
  }
  if (cheap) notices.push("Urutan memakai harga tiket dewasa yang tercatat; harga bisa berubah, cek informasi resmi.");

  const label = describeWhen(when, dayOffset);
  const lines = top.map(({ dest, pick }, i) => {
    const slot = pick.slot;
    const temp = slot.t !== null ? `, ${Math.round(slot.t)}°C` : "";
    return `${i + 1}. ${dest.name} (skor ${slot.score}, ${slot.weatherDesc ?? "cuaca terdata"}${temp}, ${slotPhrase(slot, dayOffset)})`;
  });
  const reply = `Untuk ${label}, pilihan terbaik menurut prakiraan BMKG: ${lines.join("; ")}.`;

  return {
    type: "recommend",
    cards,
    itinerary: null,
    notices,
    unavailable: [],
    baseReply: reply,
    allowRewrite: true,
    suggestions: [
      `Rencana 1 hari ${DAY_NAMES[dayOffset].toLowerCase()}`,
      cards[1] ? `Bandingkan ${cards[0].name} dan ${cards[1].name}` : `Info ${cards[0].name}`,
      "Kalau hujan ke mana?",
    ],
    focus: cards.map((c) => c.slug),
  };
}

function compare(input: EngineInput): EngineResult {
  const { items, when, now } = input;
  const chosen = input.slugs.map((slug) => items.find((d) => d.slug === slug)).filter((d): d is EngineDestination => Boolean(d)).slice(0, 3);

  if (chosen.length < 2) {
    if (chosen.length === 1) {
      const same = items.filter((d) => d.category === chosen[0].category && d.slug !== chosen[0].slug).slice(0, 3).map((d) => d.name);
      return emptyResult(
        "compare",
        `Saya baru mengenali ${chosen[0].name}. Mau dibandingkan dengan destinasi mana?${same.length ? ` Misalnya: ${joinNames(same)}.` : ""}`,
        { suggestions: same.map((n) => `Bandingkan ${chosen[0].name} dan ${n}`), focus: [chosen[0].slug] },
      );
    }
    return ask(items, input, "Destinasi mana saja yang ingin dibandingkan? Sebutkan dua nama.");
  }

  const dayOffset = dayOffsetOf(when);
  const dayKey = getWibDateKey(new Date(now.getTime() + dayOffset * 86_400_000));
  const notices: string[] = [];
  const rows = chosen.map((dest) => ({ dest, pick: pickSlot(dest.slots, dayKey, when, now) }));

  if (rows.every((r) => r.pick.status === "no_forecast" || r.pick.status === "past")) {
    return emptyResult("compare", `Maaf, prakiraan untuk ${describeWhen(when, dayOffset)} tidak tersedia atau sudah lewat, jadi perbandingan belum bisa dibuat.`, {
      unavailable: ["prakiraan"],
    });
  }

  const cards = rows.map(({ dest, pick }) => {
    const reasons = pick.slot?.reasons.slice(0, 2) ?? [];
    if (pick.status === "closed") reasons.unshift("Tutup pada waktu itu.");
    if (dest.alert) reasons.unshift("Ada peringatan dini cuaca BMKG di wilayah ini.");
    return toCard(dest, pick.slot, dayOffset, { reasons: reasons.slice(0, 3) });
  });

  const scored = rows.filter((r) => r.pick.status === "ok" && r.pick.slot && r.pick.slot.score !== null && !r.dest.alert);
  const label = describeWhen(when, dayOffset);
  const parts = rows.map(({ dest, pick }) =>
    pick.status === "ok" && pick.slot
      ? `${dest.name} skor ${pick.slot.score} (${pick.slot.weatherDesc ?? "cuaca terdata"}${pick.slot.t !== null ? `, ${Math.round(pick.slot.t)}°C` : ""})`
      : `${dest.name} ${pick.status === "closed" ? "tutup pada waktu itu" : "tanpa prakiraan"}`,
  );

  let verdict: string;
  if (scored.length === 0) {
    verdict = "Tidak ada yang bisa dipilih karena semuanya tutup, tanpa prakiraan, atau ada peringatan cuaca.";
  } else {
    scored.sort((a, b) => (b.pick.slot!.score as number) - (a.pick.slot!.score as number));
    const [first, second] = scored;
    const diff = second ? (first.pick.slot!.score as number) - (second.pick.slot!.score as number) : 99;
    verdict =
      diff < 5 && second
        ? `Skornya hampir setara; ${first.dest.name} unggul tipis.`
        : `${first.dest.name} lebih disarankan${second ? ` (selisih ${diff} poin)` : ""}.`;
  }
  notices.push("Skor adalah rekomendasi berbasis prakiraan, bukan jaminan kondisi di lokasi.");

  return {
    type: "compare",
    cards,
    itinerary: null,
    notices,
    unavailable: [],
    baseReply: `Perbandingan untuk ${label}: ${parts.join("; ")}. ${verdict}`,
    allowRewrite: true,
    suggestions: [`Info ${chosen[0].name}`, "Rencana 1 hari untuk besok"],
    focus: chosen.map((d) => d.slug),
  };
}

async function info(input: EngineInput): Promise<EngineResult> {
  const { items, when, now } = input;
  const dest = items.find((d) => d.slug === input.slugs[0]);
  if (!dest) {
    if (input.unknownPlaces.length > 0) return unknownPlaceResult(input);
    return ask(items, input, "Destinasi mana yang Anda maksud?");
  }

  // Tanpa topik spesifik (mis. hanya menyebut nama): ringkasan pendek; detail ada di kartu.
  const topics: Topic[] = input.topics.length > 0 ? input.topics : ["lokasi", "jam_buka", "tiket"];
  const dayOffset = dayOffsetOf(when);
  const dayKey = getWibDateKey(new Date(now.getTime() + dayOffset * 86_400_000));
  const pick = pickSlot(dest.slots, dayKey, when, now);
  const lines: string[] = [];
  const unavailable: string[] = [];
  const details: string[] = [];
  const notices: string[] = [];

  for (const topic of topics) {
    if (topic === "lokasi") {
      const r = dest.region;
      lines.push(`${dest.name} berada di Desa ${r.desa}, Kecamatan ${r.kecamatan}, ${/^kota\b/i.test(r.kabupaten) ? r.kabupaten : `Kabupaten ${r.kabupaten}`}, DIY. Tombol "Sorot di peta" menampilkan titiknya.`);
    } else if (topic === "jam_buka") {
      const hours = openHoursText(dest);
      lines.push(`Jam buka ${dest.name}: ${hours.text}. ${verificationNote(dest)}`);
    } else if (topic === "tiket") {
      const price = dest.enrichment?.ticketPrice;
      if (price?.domestic) {
        lines.push(`Tiket masuk ${dest.name}: ${price.domestic}${price.parking ? `; parkir ${price.parking}` : ""}.`);
        notices.push("Harga tiket dapat berubah; cek informasi resmi pengelola.");
      } else {
        unavailable.push(`harga tiket ${dest.name}`);
        lines.push(`Maaf, harga tiket ${dest.name} belum tercatat di sistem kami.`);
      }
    } else if (topic === "fasilitas") {
      if (!input.fetchFacilities) {
        unavailable.push(`fasilitas ${dest.name}`);
        lines.push(`Maaf, data fasilitas ${dest.name} sedang tidak dapat dibaca.`);
      } else {
        const near = await input.fetchFacilities(dest);
        const counts = new Map<FacilityType, number>();
        for (const f of near) counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
        const wanted = (["toilet", "parkir", "makan", "ibadah", "atm"] as FacilityType[]).filter((t) => counts.has(t));
        const asked = requestedFacilityTypes(input.query);
        const missing = asked.filter((t) => !counts.has(t));
        if (wanted.length === 0) {
          lines.push(`Belum ada fasilitas (toilet, parkir, tempat makan, ibadah, ATM) yang terpetakan di OpenStreetMap dalam radius 1 km dari ${dest.name}. Itu bisa berarti datanya belum dipetakan, bukan berarti tidak ada.`);
        } else {
          const text = wanted.map((t) => `${counts.get(t)} ${FACILITY_LABEL[t].toLowerCase()}`).join(", ");
          lines.push(`Di sekitar ${dest.name} (radius 1 km, data OpenStreetMap) terpetakan: ${text}.`);
          details.push(`Radius 1 km: ${text}`);
          if (missing.length > 0) {
            lines.push(`Untuk ${joinNames(missing.map((t) => FACILITY_LABEL[t].toLowerCase()))}, belum ada yang terpetakan di OpenStreetMap (bisa berarti belum dipetakan, bukan berarti tidak ada).`);
          }
        }
      }
    } else if (topic === "cuaca") {
      if (pick.slot && pick.status !== "no_forecast") {
        const t = pick.slot.t !== null ? `, ${Math.round(pick.slot.t)}°C` : "";
        lines.push(`Prakiraan ${slotPhrase(pick.slot, dayOffset)}: ${pick.slot.weatherDesc ?? "cuaca terdata"}${t}.`);
      } else {
        unavailable.push(`prakiraan ${dest.name}`);
        lines.push(`Maaf, prakiraan ${dest.name} untuk waktu itu belum tersedia.`);
      }
    } else if (topic === "tips") {
      const tips = dest.enrichment?.tips.slice(0, 2) ?? [];
      if (tips.length > 0) lines.push(`Tips: ${tips.join(" ")}`);
      else {
        unavailable.push(`tips ${dest.name}`);
        lines.push(`Maaf, tips berkunjung ${dest.name} belum tercatat di sistem kami.`);
      }
    } else if (topic === "sorotan") {
      const highlights = dest.enrichment?.highlights.slice(0, 2) ?? [];
      if (highlights.length > 0) lines.push(`Daya tarik: ${highlights.join("; ")}.`);
      else if (dest.description) lines.push(dest.description);
    } else if (topic === "jarak") {
      unavailable.push("rute dan waktu tempuh");
      lines.push("Maaf, rute dan waktu tempuh dari lokasi Anda belum ada di sistem kami. Tombol \"Buka rute di Google Maps\" di halaman destinasi bisa membantu.");
    }
  }

  if (dest.alert) notices.push(`Ada peringatan dini cuaca BMKG di wilayah ${dest.name}.`);

  return {
    type: "info",
    cards: [toCard(dest, pick.slot, dayOffset, { details, reasons: dest.enrichment?.highlights.slice(0, 1) ?? [] })],
    itinerary: null,
    notices,
    unavailable,
    baseReply: lines.join(" "),
    allowRewrite: false, // jawaban info sudah faktual dan lengkap; tidak perlu dirapikan model
    suggestions: [`Waktu terbaik ke ${dest.name}`, `Kalau hujan, alternatif ${dest.name}?`],
    focus: [dest.slug],
  };
}

function unknownPlaceResult(input: EngineInput): EngineResult {
  const names = input.unknownPlaces;
  const near = closestNames(names.join(" "), input.items.map((d) => ({ slug: d.slug, name: d.name })));
  return emptyResult(
    input.intent,
    `Maaf, ${joinNames(names)} belum ada di katalog Wistara. Saat ini kami hanya mencakup 20 destinasi di DIY, jadi data cuaca dan skornya belum tersedia. Destinasi mirip yang bisa saya bantu: ${joinNames(near.map((n) => n.name))}.`,
    { unavailable: names, suggestions: near.map((n) => `Info ${n.name}`) },
  );
}

async function explain(input: EngineInput): Promise<EngineResult> {
  const { items, when, now } = input;
  const dest = items.find((d) => d.slug === input.slugs[0]);
  if (!dest) return input.unknownPlaces.length > 0 ? unknownPlaceResult(input) : ask(items, input, "Skor destinasi mana yang ingin dijelaskan?");

  const dayOffset = dayOffsetOf(when);
  const dayKey = getWibDateKey(new Date(now.getTime() + dayOffset * 86_400_000));
  const pick = pickSlot(dest.slots, dayKey, when, now);
  if (!pick.slot || pick.status === "no_forecast") {
    return emptyResult("explain", `Maaf, prakiraan ${dest.name} untuk ${describeWhen(when, dayOffset)} belum tersedia, jadi skornya belum bisa dijelaskan.`, { unavailable: ["prakiraan"] });
  }
  const slot = pick.slot;
  const phrase = slotPhrase(slot, dayOffset);
  let reply: string;
  if (!slot.isOpen || slot.score === null) {
    reply = `${dest.name} tidak dinilai pada ${phrase} karena berada di luar jam buka (${openHoursText(dest).text}).`;
  } else if (slot.reasons.length === 0) {
    const lowQuery = /\b(rendah|jelek|kurang|buruk)\b/.test(input.query.toLowerCase());
    reply = `Skor ${dest.name} pada ${phrase} adalah ${slot.score} (${slot.label})${lowQuery && slot.score >= 75 ? ", jadi tergolong tinggi, bukan rendah" : ""}. Tidak ada faktor cuaca yang menurunkan skor secara berarti.`;
  } else {
    reply = `Skor ${dest.name} pada ${phrase} adalah ${slot.score} (${slot.label}). Faktor yang mempengaruhi: ${slot.reasons.join("; ")}.`;
  }
  return {
    type: "explain",
    cards: [toCard(dest, slot, dayOffset)],
    itinerary: null,
    notices: ["Skor adalah rekomendasi berbasis prakiraan BMKG, bukan jaminan kondisi di lokasi."],
    unavailable: [],
    baseReply: reply,
    allowRewrite: true,
    suggestions: [`Kalau hujan, alternatif ${dest.name}?`, `Waktu terbaik ke ${dest.name}`],
    focus: [dest.slug],
  };
}

async function alternative(input: EngineInput): Promise<EngineResult> {
  const { items, when, now } = input;
  const dayOffset = dayOffsetOf(when);
  const dayKey = getWibDateKey(new Date(now.getTime() + dayOffset * 86_400_000));
  const dest = items.find((d) => d.slug === input.slugs[0]);

  if (dest && input.fetchAlternatives) {
    const pick = pickSlot(dest.slots, dayKey, when, now);
    if (pick.slot && pick.status !== "no_forecast") {
      const alts = await input.fetchAlternatives(dest, pick.slot);
      const cards = alts
        .map((alt) => items.find((d) => d.slug === alt.slug))
        .filter((d): d is EngineDestination => Boolean(d))
        .map((d) => toCard(d, pickSlot(d.slots, dayKey, when, now).slot, dayOffset, { reasons: ["Ruang tertutup yang berdekatan dengan destinasi asal."] }));
      if (cards.length > 0) {
        return {
          type: "alternative",
          cards,
          itinerary: null,
          notices: [],
          unavailable: [],
          baseReply: `Alternatif ruang tertutup dekat ${dest.name} untuk ${describeWhen(when, dayOffset)}: ${joinNames(cards.map((c) => `${c.name}${c.score !== null ? ` (skor ${c.score})` : ""}`))}.`,
          allowRewrite: true,
          suggestions: [`Info ${cards[0].name}`],
          focus: cards.map((c) => c.slug),
        };
      }
      return emptyResult("alternative", `Maaf, tidak ada alternatif ruang tertutup yang buka dan berskor baik dalam radius 15 km dari ${dest.name} pada ${slotPhrase(pick.slot, dayOffset)}. Bisa jadi tempat-tempat itu belum buka pada jam tersebut; coba tanyakan untuk jam lain, misalnya siang.`, {
        focus: [dest.slug],
      });
    }
  }

  const indoor = items.filter((d) => !d.alert && (d.isIndoor || d.attr.isShadedOrIndoor));
  const picks = indoor
    .map((d) => ({ d, pick: pickSlot(d.slots, dayKey, when, now) }))
    .filter((p) => p.pick.status === "ok" && p.pick.slot);
  picks.sort((a, b) => (b.pick.slot!.score as number) - (a.pick.slot!.score as number));
  const top = picks.slice(0, 3);
  if (top.length === 0) {
    return emptyResult("alternative", `Maaf, saat ini tidak ada destinasi ruang tertutup yang buka dengan prakiraan tersedia untuk ${describeWhen(when, dayOffset)}.`, {
      unavailable: ["alternatif ruang tertutup"],
    });
  }
  const cards = top.map(({ d, pick }) => toCard(d, pick.slot, dayOffset, { reasons: ["Ruang tertutup atau teduh, nyaman saat hujan atau terik."] }));
  return {
    type: "alternative",
    cards,
    itinerary: null,
    notices: [],
    unavailable: [],
    baseReply: `Pilihan ruang tertutup atau teduh untuk ${describeWhen(when, dayOffset)}: ${joinNames(cards.map((c) => `${c.name} (skor ${c.score})`))}.`,
    allowRewrite: true,
    suggestions: [`Info ${cards[0].name}`, "Rencana 1 hari untuk besok"],
    focus: cards.map((c) => c.slug),
  };
}

function itinerary(input: EngineInput): EngineResult {
  const { items, when, now } = input;
  const dayOffset = dayOffsetOf(when, 1);
  const dayKey = getWibDateKey(new Date(now.getTime() + dayOffset * 86_400_000));
  const dayLabel = DAY_NAMES[dayOffset] ?? "Hari terpilih";
  const notices: string[] = [];
  if (input.days > 1) notices.push("Saat ini rencana yang bisa disusun baru 1 hari; berikut rencana untuk satu hari saja.");
  if (input.requests && input.requests.length > 0) return requestedItinerary(input, dayOffset, dayKey, dayLabel, notices);

  const plannerItems = items.map((d) => ({
    slug: d.slug,
    name: d.name,
    category: d.category,
    lat: d.lat,
    lon: d.lon,
    kabupaten: d.region.kabupaten,
    isIndoor: d.isIndoor,
    slots: dayOffset === 0 ? upcomingSlots(d.slots, now) : d.slots,
    hasWarning: Boolean(d.alert),
  }));
  const plan = planItinerary(plannerItems, dayKey, { dayLabel });

  if (!plan) {
    const reason =
      dayOffset === 0
        ? "Sebagian besar waktu hari ini sudah lewat atau destinasi sudah tutup, sehingga rencana pagi–siang–sore tidak bisa disusun."
        : "Tidak ada kombinasi destinasi yang buka dengan prakiraan lengkap untuk pagi, siang, dan sore.";
    return emptyResult("itinerary", `Maaf, rencana 1 hari untuk ${dayLabel.toLowerCase()} belum bisa disusun. ${reason}${dayOffset === 0 ? " Coba minta rencana untuk besok." : ""}`, {
      notices,
      suggestions: dayOffset === 0 ? ["Rencana 1 hari untuk besok"] : ["Rencana 1 hari untuk lusa", "Besok pagi enaknya ke mana?"],
    });
  }

  const cards = plan.slots.map((slot) => {
    const dest = items.find((d) => d.slug === slot.destination.slug)!;
    return toCard(dest, null, dayOffset, {
      score: slot.destination.score,
      weatherDesc: slot.destination.weatherDesc,
      temp: slot.destination.temp,
      isOpen: true,
      reasons: [slot.notes],
      slotLabel: slot.timeLabel,
    });
  });
  notices.push(...plan.notices, "Perkiraan waktu tempuh memakai jarak garis lurus dikali 1,4 dengan kecepatan 30 km/jam; kondisi lalu lintas sebenarnya bisa berbeda.");

  const lines = plan.slots.map((s) => `${s.part} ${s.destination.name} (skor ${s.destination.score}, ${s.destination.temp}°C)`);
  const save = input.isLoggedIn
    ? "Anda bisa langsung menyimpannya ke Rencana Saya."
    : "Masuk atau daftar dulu jika ingin menyimpan rencana ini ke akun Anda.";
  return {
    type: "itinerary",
    cards,
    itinerary: plan,
    notices,
    unavailable: [],
    baseReply: `Rencana 1 hari untuk ${dayLabel.toLowerCase()}: ${lines.join("; ")}. ${save}`,
    allowRewrite: true,
    suggestions: ["Kalau hujan ke mana?", `Info ${cards[0].name}`],
    focus: cards.map((c) => c.slug),
  };
}

const APP_HELP: { match: RegExp; reply: string }[] = [
  {
    match: /\b(simpan|rencana saya|akun|login|masuk|daftar)\b/,
    reply:
      "Untuk menyimpan rencana, masuk atau daftar akun lebih dulu. Setelah rencana disusun, tekan \"Simpan ke Rencana Saya\"; rencana yang tersimpan bisa dibuka di menu Rencana dan skornya selalu dihitung ulang dari prakiraan terbaru.",
  },
  {
    match: /\b(skor|nilai|dihitung|hitung|arti)\b/,
    reply:
      "Skor 0–100 menunjukkan seberapa nyaman sebuah destinasi dikunjungi pada slot 3 jam, dihitung dari prakiraan BMKG (hujan, angin, panas, dan jarak pandang). Skor 75 ke atas berarti sangat sesuai, 50–74 cukup sesuai, di bawah 50 kurang sesuai. Slot di luar jam buka ditandai tutup. Rumus lengkap ada di halaman Tentang Data.",
  },
  {
    match: /\b(data|sumber)\b/,
    reply: "Prakiraan cuaca dan peringatan dini berasal dari BMKG, sedangkan fasilitas sekitar dari OpenStreetMap. Detail dan lisensinya ada di halaman Tentang Data.",
  },
];

function appHelp(input: EngineInput): EngineResult {
  const t = input.query.toLowerCase();
  const hit = APP_HELP.find((h) => h.match.test(t));
  const reply =
    hit?.reply ??
    "Saya Wistara AI. Saya membantu memilih waktu terbaik berkunjung ke 20 destinasi di DIY berdasarkan prakiraan BMKG 3 hari: rekomendasi per jam, perbandingan dua tempat, alternatif saat hujan, informasi jam buka dan tiket, serta rencana 1 hari. Saya tidak menjawab di luar topik itu, dan bila data tidak ada saya akan mengatakannya.";
  return emptyResult("app_help", reply, { suggestions: CAPABILITY_SUGGESTIONS });
}

function clarify(input: EngineInput): EngineResult {
  const greeting = input.query.trim().length <= 20;
  return emptyResult(
    "clarify",
    greeting
      ? "Halo! Saya Wistara AI. Tanyakan waktu terbaik ke destinasi di DIY, rekomendasi saat panas atau hujan, informasi jam buka dan tiket, atau minta saya menyusun rencana 1 hari."
      : "Maaf, saya belum menangkap maksud pertanyaan itu. Coba sebutkan destinasi atau waktunya, misalnya \"besok pagi enaknya ke mana?\" atau \"Candi Prambanan buka jam berapa?\".",
    { suggestions: CAPABILITY_SUGGESTIONS },
  );
}

function outOfScope(): EngineResult {
  return emptyResult(
    "out_of_scope",
    "Maaf, saya hanya bisa membantu soal waktu terbaik berkunjung, cuaca, fasilitas, dan rencana ke 20 destinasi wisata di DIY. Untuk hal lain saya tidak bisa membantu.",
    { suggestions: CAPABILITY_SUGGESTIONS.slice(0, 3) },
  );
}

/* --------------------------------- pintu masuk --------------------------------- */

export async function runEngine(input: EngineInput): Promise<EngineResult> {
  switch (input.intent) {
    case "out_of_scope":
      return outOfScope();
    case "unsupported":
      return unsupportedResult(input.unsupported ?? "lainnya");
    case "app_help":
      return appHelp(input);
    case "clarify":
      return input.unknownPlaces.length > 0 ? unknownPlaceResult(input) : clarify(input);
    default:
      break;
  }

  const beyond = pastOrBeyond(input);
  if (beyond) return beyond;

  if (input.unknownPlaces.length > 0 && input.slugs.length === 0) return unknownPlaceResult(input);
  if (input.ambiguousReference && input.slugs.length === 0 && ["info", "explain", "compare"].includes(input.intent)) {
    return ask(input.items, input, "Maaf, saya belum tahu destinasi mana yang Anda maksud.");
  }

  let result: EngineResult;
  switch (input.intent) {
    case "compare":
      result = compare(input);
      break;
    case "info":
      result = await info(input);
      break;
    case "explain":
      result = await explain(input);
      break;
    case "alternative":
      result = await alternative(input);
      break;
    case "itinerary":
      result = itinerary(input);
      break;
    default:
      result = recommend(input);
  }

  if (input.unknownPlaces.length > 0 && result.cards.length > 0) {
    result.notices.unshift(`${joinNames(input.unknownPlaces)} belum ada di katalog kami, jadi tidak ikut dinilai.`);
  }
  return result;
}

/** Jenis fasilitas yang disebut pengguna ("ada toilet?", "parkir", "tempat makan"). */
function requestedFacilityTypes(query: string): FacilityType[] {
  const t = query.toLowerCase();
  const types: FacilityType[] = [];
  if (/\b(toilet|wc|kamar mandi)\b/.test(t)) types.push("toilet");
  if (/\bparkir\b/.test(t)) types.push("parkir");
  if (/\b(makan|restoran|warung|kantin|resto)\b/.test(t)) types.push("makan");
  if (/\b(musala|mushola|masjid|ibadah)\b/.test(t)) types.push("ibadah");
  if (/\batm\b/.test(t)) types.push("atm");
  return types;
}

/**
 * Skor untuk mengurutkan: skor kenyamanan ditambah bonus kecil agar preferensi menjadi pembeda
 * saat skor setara (mis. banyak destinasi berskor 100). Skor yang ditampilkan tidak berubah.
 */
function rankScore(dest: EngineDestination, slot: ScoredSlot, preferences: Preference[]): number {
  let rank = slot.score ?? 0;
  if (preferences.includes("keluarga")) {
    if (dest.enrichment?.tags.includes("Keluarga")) rank += 3;
    if ((dest.isIndoor || dest.attr.isShadedOrIndoor) && (slot.t ?? 0) >= 30) rank += 3;
  }
  if (preferences.includes("foto") && dest.enrichment?.tags.some((t) => /foto/i.test(t))) rank += 3;
  if (preferences.includes("sunset") && dest.attr.isSunsetSpot) rank += 3;
  return rank;
}

/** Rencana menurut permintaan pengguna: urutan, nama, dan waktu dipakai; konflik dikatakan terus terang. */
function requestedItinerary(input: EngineInput, dayOffset: number, dayKey: string, dayLabel: string, notices: string[]): EngineResult {
  const { items, now } = input;
  const { plan, adjustments } = planRequestedItinerary(items, input.requests ?? [], dayKey, dayLabel, now, {
    hoursText: (dest) => openHoursText(dest).text,
    slotRange,
    slotPhrase: (slot) => slotPhrase(slot, dayOffset),
  });

  if (!plan) {
    return emptyResult("itinerary", `Maaf, rencana yang Anda minta belum bisa disusun. ${adjustments.join(" ")}`.trim(), {
      notices,
      suggestions: ["Rencana 1 hari untuk besok", "Besok pagi enaknya ke mana?"],
    });
  }

  const cards = plan.slots.map((slot) => {
    const dest = items.find((d) => d.slug === slot.destination.slug)!;
    return toCard(dest, null, dayOffset, {
      score: slot.destination.score,
      weatherDesc: slot.destination.weatherDesc,
      temp: slot.destination.temp,
      isOpen: true,
      reasons: [slot.notes],
      slotLabel: slot.timeLabel,
    });
  });
  notices.push(...plan.notices, "Perkiraan waktu tempuh memakai jarak garis lurus dikali 1,4 dengan kecepatan 30 km/jam; kondisi lalu lintas sebenarnya bisa berbeda.");
  const lines = plan.slots.map((s) => `${s.part} ${s.destination.name} (skor ${s.destination.score}, ${s.destination.temp}°C)`);
  const save = input.isLoggedIn
    ? "Anda bisa langsung menyimpannya ke Rencana Saya."
    : "Masuk atau daftar dulu jika ingin menyimpan rencana ini ke akun Anda.";
  return {
    type: "itinerary",
    cards,
    itinerary: plan,
    notices,
    unavailable: [],
    baseReply: `Rencana 1 hari untuk ${dayLabel.toLowerCase()} sesuai permintaan Anda: ${lines.join("; ")}. ${adjustments.join(" ")} ${save}`.replace(/\s+/g, " ").trim(),
    allowRewrite: adjustments.length === 0,
    suggestions: ["Kalau hujan ke mana?", `Info ${cards[0].name}`],
    focus: cards.map((c) => c.slug),
  };
}
