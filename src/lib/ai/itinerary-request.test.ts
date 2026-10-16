import { describe, expect, it } from "vitest";
import { runEngine, type EngineDestination } from "./engine";
import { extractItineraryRequests } from "./itinerary-request";
import { CATALOG_ENTRIES, makeDest, makeSlot, NOW, TOMORROW, TODAY } from "./test-helpers";
import { mergeUnderstanding } from "./understand";

const QUERY = "buatin rencana dong, yang pertama keraton pas siang, trus pantai glagah sore, yang terakhir taman sari pas malam";
const HOURS = [6, 9, 12, 15, 18, 21];

/** Slot per jam dengan skor hanya pada jam yang buka (mengikuti aturan: buka bila jam mulai di dalam jam buka). */
const slotsOpen = (openFrom: number, openUntil: number, score = 90) => [
  ...HOURS.map((h) => makeSlot(TODAY, h, null)),
  ...HOURS.map((h) => makeSlot(TOMORROW, h, h >= openFrom && h < openUntil ? score : null)),
];

function plan(query: string, items: EngineDestination[]) {
  const u = mergeUnderstanding(query, { now: NOW, catalog: CATALOG_ENTRIES, focus: [] }, null);
  return runEngine({
    now: NOW,
    query,
    intent: u.intent,
    unsupported: u.unsupported,
    when: u.when,
    slugs: u.slugs,
    unknownPlaces: u.unknownPlaces,
    ambiguousReference: u.ambiguousReference,
    categories: u.categories,
    preferences: u.preferences,
    topics: u.topics,
    days: u.days,
    requests: u.itineraryRequests,
    isLoggedIn: false,
    items,
  });
}

describe("extractItineraryRequests", () => {
  it("mengambil destinasi, urutan, dan waktunya dari kalimat bebas", () => {
    expect(extractItineraryRequests(QUERY, CATALOG_ENTRIES, NOW)).toEqual([
      { slug: "keraton-yogyakarta", hour: null, part: "siang" },
      { slug: "pantai-glagah", hour: null, part: "sore" },
      { slug: "taman-sari", hour: null, part: "malam" },
    ]);
  });

  it("jam tepat dan tanpa waktu", () => {
    const r = extractItineraryRequests("rencana besok: prambanan jam 8 pagi lalu keraton", CATALOG_ENTRIES, NOW);
    expect(r).toEqual([
      { slug: "candi-prambanan", hour: 8, part: "pagi" },
      { slug: "keraton-yogyakarta", hour: null, part: null },
    ]);
  });

  it("tanpa nama destinasi: kosong (memakai penyusun otomatis)", () => {
    expect(extractItineraryRequests("bikinin rencana 1 hari besok", CATALOG_ENTRIES, NOW)).toEqual([]);
  });
});

describe("rencana sesuai permintaan", () => {
  const keraton = makeDest("keraton-yogyakarta", { slots: slotsOpen(6, 16), lat: -7.805, lon: 110.364 });
  const glagah = makeDest("pantai-glagah", { slots: slotsOpen(6, 18, 95), lat: -7.9, lon: 110.1 });
  const tamanSari = makeDest("taman-sari", {
    slots: slotsOpen(9, 15, 88),
    openHours: { mon: ["09:00", "15:00"], tue: ["09:00", "15:00"], wed: ["09:00", "15:00"], thu: ["09:00", "15:00"], fri: ["09:00", "15:00"], sat: ["09:00", "15:00"], sun: ["09:00", "15:00"] },
    verifiedAt: null,
    lat: -7.81,
    lon: 110.359,
  });

  it("memakai destinasi dan waktu yang diminta; yang tutup dipindah dengan penjelasan jujur", async () => {
    const r = await plan(QUERY, [keraton, glagah, tamanSari]);
    expect(r.type).toBe("itinerary");
    const names = r.itinerary!.slots.map((s) => s.destination.name);
    expect(names).toEqual(["Taman Sari", "Keraton Yogyakarta", "Pantai Glagah"]); // Taman Sari dipindah ke slot buka terdekat
    expect(r.itinerary!.slots.map((s) => s.part)).toEqual(["pagi", "siang", "sore"]);
    expect(r.baseReply).toContain("Taman Sari tutup pada waktu malam");
    expect(r.baseReply).toContain("pindahkan");
    expect(r.baseReply).toContain("09.00–12.00"); // jam buka disebut apa adanya dari data
    expect(r.allowRewrite).toBe(false); // penjelasan konflik tidak boleh hilang oleh model
  });

  it("tidak membawa destinasi yang tidak diminta", async () => {
    const extra = makeDest("candi-prambanan", { slots: slotsOpen(6, 18, 100) });
    const r = await plan(QUERY, [keraton, glagah, tamanSari, extra]);
    expect(r.itinerary!.slots.map((s) => s.destination.slug)).not.toContain("candi-prambanan");
  });

  it("destinasi yang sama sekali tidak buka dikeluarkan dan dikatakan", async () => {
    const closedAll = makeDest("taman-sari", { slots: slotsOpen(99, 99) });
    const r = await plan(QUERY, [keraton, glagah, closedAll]);
    expect(r.itinerary!.slots.map((s) => s.destination.name)).toEqual(["Keraton Yogyakarta", "Pantai Glagah"]);
    expect(r.baseReply).toContain("tidak saya masukkan");
  });

  it("semua permintaan tidak bisa dipenuhi: menolak sopan, tanpa rencana karangan", async () => {
    const closed = [keraton, glagah, tamanSari].map((d) => ({ ...d, slots: slotsOpen(99, 99) }));
    const r = await plan(QUERY, closed);
    expect(r.itinerary).toBeNull();
    expect(r.baseReply).toContain("belum bisa disusun");
  });

  it("tanpa waktu: berurutan menurut slot terbaik setelah langkah sebelumnya", async () => {
    const r = await plan("rencana besok ke keraton lalu pantai glagah", [keraton, glagah]);
    expect(r.itinerary!.slots.map((s) => s.destination.name)).toEqual(["Keraton Yogyakarta", "Pantai Glagah"]);
  });

  it("tanpa nama destinasi tetap memakai penyusun otomatis", async () => {
    const r = await plan("bikinin rencana 1 hari besok", [keraton, glagah, tamanSari]);
    expect(r.type).toBe("itinerary");
  });
});
