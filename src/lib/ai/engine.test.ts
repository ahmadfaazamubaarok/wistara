import { describe, expect, it } from "vitest";
import { runEngine, type EngineInput } from "./engine";
import { mergeUnderstanding } from "./understand";
import { CATALOG_ENTRIES, daySlots, makeDest, makeSlot, NOW, TODAY, TOMORROW } from "./test-helpers";
import type { EngineDestination } from "./engine";

function ask(query: string, items: EngineDestination[], overrides: Partial<EngineInput> = {}, focus: string[] = []) {
  const u = mergeUnderstanding(query, { now: NOW, catalog: CATALOG_ENTRIES, focus }, null);
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
    isLoggedIn: false,
    items,
    ...overrides,
  });
}

const tomorrowSlots = (scores: (number | null)[], hours = [6, 9, 12, 15]) => [
  ...daySlots(TODAY, [null, null, null, null]),
  ...daySlots(TOMORROW, scores, hours),
];

describe("info: jujur bila data tidak ada, tidak mengganti destinasi", () => {
  const tembi = makeDest("desa-wisata-tembi");
  const prambanan = makeDest("candi-prambanan", { enrichment: undefined });

  it("jam buka Tembi dijawab untuk Tembi, dengan catatan belum diverifikasi", async () => {
    const r = await ask("desa tembi buka jam berapa", [prambanan, tembi]);
    expect(r.type).toBe("info");
    expect(r.cards.map((c) => c.slug)).toEqual(["desa-wisata-tembi"]);
    expect(r.baseReply).toContain("Desa Wisata Tembi");
    expect(r.baseReply).toContain("tidak ada jam buka tetap");
    expect(r.baseReply).toContain("belum diverifikasi");
    expect(r.baseReply).not.toContain("Prambanan");
  });

  it("jam buka yang tercatat ditampilkan beserta tanggal verifikasi", async () => {
    const withHours = makeDest("candi-prambanan", {
      openHours: { mon: ["08:00", "16:00"], tue: ["08:00", "16:00"], wed: ["08:00", "16:00"], thu: ["08:00", "16:00"], fri: ["08:00", "16:00"], sat: ["08:00", "16:00"], sun: ["08:00", "16:00"] },
      verifiedAt: "2026-10-10",
    });
    const r = await ask("prambanan buka jam berapa", [withHours]);
    expect(r.baseReply).toContain("08.00–16.00");
    expect(r.baseReply).toContain("2026-10-10");
  });

  it("harga tiket yang tidak tercatat dinyatakan tidak ada, bukan dikarang", async () => {
    const r = await ask("tiket desa tembi berapa", [tembi]);
    expect(r.unavailable).toContain("harga tiket Desa Wisata Tembi");
    expect(r.baseReply).toContain("belum tercatat");
    expect(r.allowRewrite).toBe(false);
  });

  it("harga tiket yang tercatat ditampilkan apa adanya", async () => {
    const dest = makeDest("museum-sonobudoyo", {
      enrichment: { ticketPrice: { domestic: "Rp 10.000 (Gedung Utama)", parking: "Motor Rp 3.000" }, highlights: [], tips: [], tags: [] },
    });
    const r = await ask("tiket sonobudoyo berapa", [dest]);
    expect(r.baseReply).toContain("Rp 10.000");
    expect(r.unavailable).toEqual([]);
  });

  it("tanpa destinasi yang jelas: bertanya balik dengan saran nama, tidak menebak", async () => {
    const r = await ask("buka jam berapa?", [prambanan, tembi]);
    expect(r.cards).toEqual([]);
    expect(r.baseReply).toContain("Destinasi mana");
  });

  it("fasilitas: menyebut jenis yang diminta dan yang tidak terpetakan", async () => {
    const r = await ask("ada toilet di desa tembi?", [tembi], {
      fetchFacilities: async () => [
        { id: 1, type: "parkir", name: null, lat: 0, lon: 0, distanceM: 100 },
        { id: 2, type: "makan", name: null, lat: 0, lon: 0, distanceM: 200 },
      ],
    });
    expect(r.baseReply).toContain("1 parkir");
    expect(r.baseReply).toContain("toilet");
    expect(r.baseReply).toContain("belum ada yang terpetakan");
  });
});

describe("tempat di luar katalog dan topik yang tidak didukung", () => {
  it("Borobudur dijawab belum ada di katalog, dengan saran terdekat", async () => {
    const r = await ask("ke Borobudur sore ini", [makeDest("candi-prambanan"), makeDest("candi-ratu-boko")]);
    expect(r.baseReply).toContain("Borobudur belum ada di katalog");
    expect(r.cards).toEqual([]);
  });

  it("keselamatan pantai tidak pernah dinyatakan aman atau tidak", async () => {
    const r = await ask("boleh berenang di parangtritis?", [makeDest("pantai-parangtritis")]);
    expect(r.type).toBe("unsupported");
    expect(r.baseReply).toContain("belum memiliki data");
    expect(r.baseReply).not.toMatch(/\baman\b.*\bberenang\b.*\bboleh\b/);
    expect(r.cards).toEqual([]);
  });

  it("di luar topik ditolak sopan", async () => {
    const r = await ask("buatkan puisi", [makeDest("candi-prambanan")]);
    expect(r.type).toBe("out_of_scope");
    expect(r.baseReply).toContain("hanya bisa membantu");
  });

  it("waktu di luar 3 hari dijawab jujur", async () => {
    const r = await ask("rekomendasi hari jumat", [makeDest("candi-prambanan")]);
    expect(r.baseReply).toContain("3 hari ke depan");
    expect(r.cards).toEqual([]);
  });
});

describe("rekomendasi", () => {
  const items = [
    makeDest("museum-ullen-sentalu", { slots: tomorrowSlots([60, 70, 92, 80]) }),
    makeDest("pantai-parangtritis", { slots: tomorrowSlots([60, 70, 99, 80]) }),
    makeDest("museum-sonobudoyo", { slots: tomorrowSlots([60, 70, 88, 80]) }),
    makeDest("candi-prambanan", { slots: tomorrowSlots([60, 70, 95, 80]) }),
  ];

  it("jam tertentu + 'tidak kepanasan' hanya memilih tempat teduh/tertutup pada slot jam itu", async () => {
    const r = await ask("besok siang jam 13.00 ke mana biar nggak kepanasan?", items);
    expect(r.cards.map((c) => c.slug)).toEqual(["museum-ullen-sentalu", "museum-sonobudoyo"]);
    expect(r.cards[0].score).toBe(92); // skor slot 12.00, bukan slot pagi
    expect(r.cards[0].slotLabel).toBe("Besok, pukul 12.00–15.00 WIB");
    expect(r.baseReply).toContain("besok pukul 13.00 WIB");
  });

  it("tanpa preferensi, diurutkan menurut skor di slot yang diminta", async () => {
    const r = await ask("besok siang ke mana?", items);
    expect(r.cards.map((c) => c.slug)).toEqual(["pantai-parangtritis", "candi-prambanan", "museum-ullen-sentalu"]);
  });

  it("filter kategori", async () => {
    const r = await ask("museum apa yang bagus besok siang", items);
    expect(r.cards.every((c) => c.category === "museum")).toBe(true);
  });

  it("destinasi dengan peringatan dini dikeluarkan dan diberi catatan", async () => {
    const warned = items.map((d) => (d.slug === "pantai-parangtritis" ? { ...d, alert: { capId: "x" } as never } : d));
    const r = await ask("besok siang ke mana?", warned);
    expect(r.cards.map((c) => c.slug)).not.toContain("pantai-parangtritis");
    expect(r.notices.join(" ")).toContain("peringatan dini");
  });

  it("semua tutup: menyebut slot buka terdekat, tidak memaksakan rekomendasi", async () => {
    const hours = [6, 9, 12, 15, 18, 21];
    const closed = items.map((d) => ({
      ...d,
      slots: [...daySlots(TODAY, hours.map(() => null), hours), ...daySlots(TOMORROW, [null, 70, 80, 60, null, null], hours)],
    }));
    const r = await ask("malam ini ke mana?", closed);
    expect(r.cards).toEqual([]);
    expect(r.baseReply).toContain("tutup");
    expect(r.baseReply).toContain("Slot buka terdekat");
  });

  it("kriteria tidak terpenuhi: kriteria dilonggarkan dengan catatan jujur", async () => {
    const noShade = [makeDest("pantai-parangtritis", { slots: tomorrowSlots([60, 70, 90, 80]) })];
    const r = await ask("besok siang tempat sejuk", noShade);
    expect(r.cards).toHaveLength(1);
    expect(r.notices.join(" ")).toContain("Tidak ada destinasi yang memenuhi");
  });

  it("preferensi keluarga mengakui data ramah balita belum ada", async () => {
    const r = await ask("liburan sama balita besok siang ke mana", items);
    expect(r.notices.join(" ")).toContain("belum ada di sistem kami");
  });
});

describe("perbandingan", () => {
  const a = makeDest("pantai-parangtritis", { slots: tomorrowSlots([60, 70, 85, 62], [6, 9, 12, 15]) });
  const b = makeDest("pantai-glagah", { slots: tomorrowSlots([60, 70, 62, 90], [6, 9, 12, 15]) });

  it("membandingkan dua destinasi pada slot yang sama dan menyebut yang lebih baik", async () => {
    const r = await ask("besok jam 12.00 aman Parangtritis atau Glagah?", [a, b]);
    expect(r.type).toBe("compare");
    expect(r.cards.map((c) => c.slug)).toEqual(["pantai-parangtritis", "pantai-glagah"]);
    expect(r.baseReply).toContain("skor 85");
    expect(r.baseReply).toContain("skor 62");
    expect(r.baseReply).toContain("Pantai Parangtritis lebih disarankan");
  });

  it("satu nama saja: menanyakan pembandingnya", async () => {
    const r = await ask("bandingkan parangtritis dengan yang lain", [a, b]);
    expect(r.baseReply).toContain("dibandingkan dengan destinasi mana");
  });
});

describe("penjelasan skor dan alternatif", () => {
  it("menjelaskan faktor yang menurunkan skor", async () => {
    const slot = makeSlot(TOMORROW, 12, 48, { reasons: ["Hujan lebat diperkirakan", "Angin kencang"] });
    const dest = makeDest("pantai-glagah", { slots: [slot] });
    const r = await ask("kenapa skor glagah besok siang rendah?", [dest]);
    expect(r.type).toBe("explain");
    expect(r.baseReply).toContain("Skor Pantai Glagah");
    expect(r.baseReply).toContain("Hujan lebat diperkirakan");
  });

  it("alternatif umum memilih ruang tertutup yang buka", async () => {
    const items = [
      makeDest("museum-affandi", { slots: tomorrowSlots([60, 70, 90, 80]) }),
      makeDest("pantai-glagah", { slots: tomorrowSlots([60, 70, 99, 80]) }),
    ];
    const r = await ask("kalau hujan besok siang ke mana?", items);
    expect(r.type).toBe("alternative");
    expect(r.cards.map((c) => c.slug)).toEqual(["museum-affandi"]);
  });
});

describe("rencana 1 hari", () => {
  it("hari ini pukul 03.00 dengan semua slot tutup: menolak sopan dan menyarankan besok", async () => {
    const items = ["candi-prambanan", "museum-affandi", "pantai-glagah"].map((s) =>
      makeDest(s, { slots: [...daySlots(TODAY, [null, null, null, null]), ...daySlots(TOMORROW, [null, null, null, null])] }),
    );
    const r = await ask("bikinin rencana 1 hari hari ini", items);
    expect(r.itinerary).toBeNull();
    expect(r.baseReply).toContain("belum bisa disusun");
  });

  it("rencana lebih dari satu hari diberi catatan jujur", async () => {
    const r = await ask("rencana 3 hari di jogja", []);
    expect(r.notices.join(" ")).toContain("baru 1 hari");
  });
});

describe("bantuan aplikasi", () => {
  it("menjelaskan arti skor dari rumus yang ada", async () => {
    const r = await ask("skor dihitung bagaimana?", []);
    expect(r.type).toBe("app_help");
    expect(r.baseReply).toContain("75");
  });
});

describe("koreksi atas anggapan pengguna", () => {
  it("bila skor sebenarnya tinggi padahal ditanya 'kenapa rendah', dikatakan terus terang", async () => {
    const dest = makeDest("pantai-glagah", { slots: [makeSlot(TOMORROW, 12, 97)] });
    const r = await ask("kenapa skor glagah besok siang rendah?", [dest]);
    expect(r.baseReply).toContain("tergolong tinggi, bukan rendah");
  });
});

describe("preferensi sebagai pembeda saat skor setara", () => {
  it("keluarga: yang bertag Keluarga diutamakan, skor yang ditampilkan tidak diubah", async () => {
    const plain = makeDest("pantai-baron", { slots: tomorrowSlots([60, 70, 100, 80]) });
    const family = makeDest("pantai-parangtritis", {
      slots: tomorrowSlots([60, 70, 100, 80]),
      enrichment: { ticketPrice: { domestic: "Rp 10.000" }, highlights: [], tips: [], tags: ["Keluarga"] },
    });
    const r = await ask("liburan sama balita besok siang ke mana", [plain, family]);
    expect(r.cards[0].slug).toBe("pantai-parangtritis");
    expect(r.cards[0].score).toBe(100);
  });
});

describe("jawaban info menjawab yang ditanya saja", () => {
  const glagah = makeDest("pantai-glagah", {
    region: { desa: "Glagah", kecamatan: "Temon", kabupaten: "Kulon Progo" },
    enrichment: { ticketPrice: { domestic: "Rp 6.000 / orang", parking: "Motor Rp 3.000" }, highlights: ["Pemecah ombak tetrapod"], tips: [], tags: [] },
  });

  it("lokasi: menyebut desa, kecamatan, dan kabupaten, tanpa jam buka atau tiket", async () => {
    const r = await ask("pantai glagah ada di daerah mana", [glagah]);
    expect(r.baseReply).toContain("Desa Glagah, Kecamatan Temon, Kabupaten Kulon Progo");
    expect(r.baseReply).not.toContain("Jam buka");
    expect(r.baseReply).not.toContain("Tiket");
  });

  it("tiket saja: tidak ikut membawa jam buka dan prakiraan", async () => {
    const r = await ask("pantai glagah harga tiketnya brp", [glagah]);
    expect(r.baseReply).toContain("Rp 6.000");
    expect(r.baseReply).not.toContain("Jam buka");
    expect(r.baseReply).not.toContain("Prakiraan");
  });

  it("hanya menyebut nama: ringkasan pendek (lokasi, jam buka, tiket), tanpa daya tarik dan cuaca", async () => {
    const r = await ask("pantai glagah", [glagah]);
    expect(r.baseReply).toContain("Desa Glagah");
    expect(r.baseReply).toContain("Rp 6.000");
    expect(r.baseReply).not.toContain("Daya tarik");
    expect(r.baseReply).not.toContain("Prakiraan");
  });

  it("pertanyaan lanjutan tanpa nama dijawab untuk destinasi sebelumnya", async () => {
    const r = await ask("harga per orangnya berapa tuh", [glagah], {}, ["pantai-glagah"]);
    expect(r.cards[0].slug).toBe("pantai-glagah");
    expect(r.baseReply).toContain("Rp 6.000");
  });
});
