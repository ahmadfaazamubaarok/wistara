import { Client, type QueryResultRow } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadSeed } from "../../scripts/lib/seed";
import { allowGeocode, enforceSubmissionLimit } from "@/lib/api/rate-limit";
import { getPool } from "@/lib/db";
import type { SubmissionInput } from "@/lib/submissions/schema";
import {
  approveSubmission,
  createSubmission,
  deleteMySubmission,
  getReviewReference,
  isAdmin,
  listMySubmissions,
  listPendingForReview,
  listRecentlyReviewed,
  rejectSubmission,
  type ApprovalDecision,
} from "@/lib/submissions/service";
import { withUser } from "@/lib/trips/service";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";

async function sql<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}

let adm4: string;

/** Titik di laut selatan Bantul: jauh dari semua destinasi, sehingga pemeriksaan duplikat tidak terpicu. */
const input = (i = 0, overrides: Partial<SubmissionInput> = {}): SubmissionInput => ({
  name: `Pantai Uji Usulan ${i}`,
  category: "pantai",
  isIndoor: false,
  lat: -8.25 - i * 0.01,
  lon: 110.3,
  kabupaten: "Bantul",
  address: "Dusun Uji, Desa Contoh, Kecamatan Contoh",
  openHours: { mon: ["08:00", "17:00"], tue: ["08:00", "17:00"] },
  description: "Pantai untuk pengujian.",
  managerName: "Pokdarwis Uji",
  managerRole: "pengelola",
  contactWa: "6281234567890",
  evidenceUrl: null,
  consent: true,
  ...overrides,
});

const decision = (overrides: Partial<ApprovalDecision> = {}): ApprovalDecision => ({
  slug: "pantai-uji-usulan-0",
  adm4Code: adm4,
  marineAreaCode: "P.N.02",
  isIndoor: false,
  hoursVerified: false,
  note: null,
  ...overrides,
});

const destinationCount = async () => Number((await sql<{ n: string }>("select count(*) as n from destinations")).rows[0].n);

async function cleanup() {
  await sql("delete from trip_items where destination_id in (select id from destinations where origin = 'usulan')");
  await sql("delete from destination_submissions");
  await sql("delete from destinations where origin = 'usulan' or slug = 'zz-bukan-seed'");
  await sql("truncate rate_limits");
}

beforeAll(async () => {
  await sql(
    `insert into auth.users (id, email) values ($1, 'alice@contoh.test'), ($2, 'bob@contoh.test'), ($3, 'admin@contoh.test')
     on conflict do nothing`,
    [ALICE, BOB, ADMIN],
  );
  await sql("insert into admins (user_id) values ($1) on conflict do nothing", [ADMIN]);
  adm4 = (await sql<{ adm4_code: string }>("select adm4_code from regions order by adm4_code limit 1")).rows[0].adm4_code;
});

beforeEach(cleanup);

afterAll(async () => {
  await cleanup();
  await sql("delete from admins where user_id = $1", [ADMIN]);
});

describe("membuat usulan", () => {
  it("tersimpan berstatus menunggu dan TIDAK membuat destinasi", async () => {
    const before = await destinationCount();
    const created = await createSubmission(ALICE, input(0));

    expect(created).toMatchObject({
      status: "menunggu",
      name: "Pantai Uji Usulan 0",
      category: "pantai",
      kabupaten: "Bantul",
      contactWa: "6281234567890",
      managerRole: "pengelola",
      destination: null,
    });
    expect(created.lat).toBeCloseTo(-8.25, 4);
    expect(created.lon).toBeCloseTo(110.3, 4);
    expect(created.openHours?.mon).toEqual(["08:00", "17:00"]);
    expect(await destinationCount()).toBe(before);
  });

  it("titik yang sangat dekat dengan destinasi yang sudah ada ditolak dengan menyebut namanya", async () => {
    const { rows } = await sql<{ lat: number; lon: number }>(
      `select extensions.st_y(location::extensions.geometry) as lat, extensions.st_x(location::extensions.geometry) as lon
       from destinations where slug = 'keraton-yogyakarta'`,
    );
    await expect(createSubmission(ALICE, input(0, { lat: rows[0].lat, lon: rows[0].lon }))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringMatching(/Keraton/i),
    });
  });

  it("maksimal 5 usulan menunggu per pengguna (dijaga trigger database)", async () => {
    for (let i = 0; i < 5; i++) await createSubmission(ALICE, input(i));
    await expect(createSubmission(ALICE, input(5))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringMatching(/Maksimal 5 usulan/),
    });
    // Batas per pengguna: Bob tidak terpengaruh.
    await expect(createSubmission(BOB, input(6))).resolves.toMatchObject({ status: "menunggu" });
  });

  it("batas laju: 5 usulan per jam, yang ke-6 ditolak dengan 429", async () => {
    for (let i = 0; i < 5; i++) await enforceSubmissionLimit(ALICE);
    await expect(enforceSubmissionLimit(ALICE)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(enforceSubmissionLimit(BOB)).resolves.toBeUndefined();
  });
});

describe("batas laju pencarian alamat dari peta", () => {
  it("20 per pengguna per menit; yang ke-21 ditolak tanpa melempar galat", async () => {
    for (let i = 0; i < 20; i++) expect(await allowGeocode(ALICE)).toBe(true);
    expect(await allowGeocode(ALICE)).toBe(false);
    expect(await allowGeocode(BOB)).toBe(true);
  });

  it("batas global 40 per menit melindungi kebijakan Nominatim (1 permintaan per detik)", async () => {
    for (let i = 0; i < 20; i++) expect(await allowGeocode(ALICE)).toBe(true);
    for (let i = 0; i < 20; i++) expect(await allowGeocode(BOB)).toBe(true);
    // Pengguna ketiga belum memakai jatahnya sendiri, tetapi jatah global sudah habis.
    expect(await allowGeocode(ADMIN)).toBe(false);
  });
});

describe("RLS: pengguna hanya menyentuh usulannya sendiri", () => {
  it("Alice dan Bob hanya melihat usulan masing-masing", async () => {
    await createSubmission(ALICE, input(0));
    await createSubmission(BOB, input(1));
    expect((await listMySubmissions(ALICE)).map((s) => s.name)).toEqual(["Pantai Uji Usulan 0"]);
    expect((await listMySubmissions(BOB)).map((s) => s.name)).toEqual(["Pantai Uji Usulan 1"]);
  });

  it("Bob tidak bisa menarik usulan Alice; Alice bisa menarik usulannya yang masih menunggu", async () => {
    const mine = await createSubmission(ALICE, input(0));
    await expect(deleteMySubmission(BOB, mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteMySubmission(ALICE, mine.id)).resolves.toBeUndefined();
    expect(await listMySubmissions(ALICE)).toEqual([]);
  });

  it("usulan yang sudah ditinjau tidak bisa ditarik", async () => {
    const mine = await createSubmission(ALICE, input(0));
    await rejectSubmission(ADMIN, mine.id, "Lokasi tidak sesuai.");
    await expect(deleteMySubmission(ALICE, mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("pengguna tidak bisa mengubah status usulannya sendiri (tanpa hak UPDATE)", async () => {
    const mine = await createSubmission(ALICE, input(0));
    await expect(
      withUser(ALICE, (c) => c.query("update destination_submissions set status = 'disetujui' where id = $1", [mine.id])),
    ).rejects.toThrow(/permission denied/i);
  });

  const insertSql = `insert into destination_submissions
      (user_id, status, name, category, location, kabupaten, address, manager_name, manager_role, consent_at)
    values ($1, $2, 'Uji Curang', 'alam', extensions.st_setsrid(extensions.st_makepoint(110.3, -8.25), 4326)::extensions.geography,
            'Bantul', 'Alamat cukup panjang', 'Pengelola', 'pengelola', now())`;

  it("tidak bisa menyisipkan usulan langsung berstatus disetujui", async () => {
    await expect(withUser(ALICE, (c) => c.query(insertSql, [ALICE, "disetujui"]))).rejects.toThrow(/row-level security/i);
  });

  it("tidak bisa menyisipkan usulan atas nama pengguna lain", async () => {
    await expect(withUser(ALICE, (c) => c.query(insertSql, [BOB, "menunggu"]))).rejects.toThrow(/row-level security/i);
  });
});

describe("hak admin", () => {
  it("isAdmin hanya benar untuk pengguna di tabel admins", async () => {
    expect(await isAdmin(ADMIN)).toBe(true);
    expect(await isAdmin(ALICE)).toBe(false);
  });

  it("non-admin ditolak (NOT_FOUND) di SEMUA fungsi admin, bukan hanya di halaman", async () => {
    const mine = await createSubmission(ALICE, input(0));
    const denied = { code: "NOT_FOUND" };
    await expect(listPendingForReview(ALICE)).rejects.toMatchObject(denied);
    await expect(listRecentlyReviewed(ALICE)).rejects.toMatchObject(denied);
    await expect(getReviewReference(ALICE)).rejects.toMatchObject(denied);
    await expect(approveSubmission(ALICE, mine.id, decision())).rejects.toMatchObject(denied);
    await expect(rejectSubmission(ALICE, mine.id, "menyetujui sendiri")).rejects.toMatchObject(denied);
    // Tidak ada yang berubah.
    expect((await listMySubmissions(ALICE))[0].status).toBe("menunggu");
    expect(await destinationCount()).toBe(365);
  });
});

describe("meninjau usulan", () => {
  it("admin melihat kontak, email pengusul, dan saran wilayah", async () => {
    // ±300 m di utara Keraton Yogyakarta, dan ±1,1 km di utara Pantai Parangtritis.
    const keraton = (
      await sql<{ lat: number; lon: number }>(
        `select extensions.st_y(location::extensions.geometry) as lat, extensions.st_x(location::extensions.geometry) as lon
         from destinations where slug = 'keraton-yogyakarta'`,
      )
    ).rows[0];
    const parang = (
      await sql<{ lat: number; lon: number }>(
        `select extensions.st_y(location::extensions.geometry) as lat, extensions.st_x(location::extensions.geometry) as lon
         from destinations where slug = 'pantai-parangtritis'`,
      )
    ).rows[0];

    await createSubmission(ALICE, input(0, { name: "Museum Dekat Keraton", category: "museum", lat: keraton.lat + 0.0027, lon: keraton.lon }));
    await createSubmission(ALICE, input(1, { name: "Pantai Dekat Parangtritis", lat: parang.lat + 0.01, lon: parang.lon }));

    const items = await listPendingForReview(ADMIN);
    const museum = items.find((i) => i.name === "Museum Dekat Keraton")!;
    const beach = items.find((i) => i.name === "Pantai Dekat Parangtritis")!;

    expect(museum.submitterEmail).toBe("alice@contoh.test");
    expect(museum.contactWa).toBe("6281234567890");
    expect(museum.suggestedSlug).toBe("museum-dekat-keraton");
    expect(museum.nearby.map((n) => n.slug)).toContain("keraton-yogyakarta");
    expect(museum.suggestedRegion?.distanceM).toBeLessThan(1000);
    expect(museum.suggestedMarineArea).toBeNull(); // bukan pantai

    expect(beach.suggestedMarineArea).toBe("P.N.02");
  });

  it("referensi peninjauan memuat wilayah cuaca dan wilayah perairan", async () => {
    const ref = await getReviewReference(ADMIN);
    expect(ref.regions.length).toBeGreaterThan(0);
    expect(ref.marineAreas.map((m) => m.code)).toEqual(["P.N.01", "P.N.02", "P.N.03"]);
  });
});

describe("menyetujui usulan", () => {
  it("membuat destinasi berasal dari usulan dan menandai usulan disetujui", async () => {
    const before = await destinationCount();
    const mine = await createSubmission(ALICE, input(0));

    const result = await approveSubmission(ADMIN, mine.id, decision({ note: "Data lengkap." }));
    expect(result.slug).toBe("pantai-uji-usulan-0");
    expect(await destinationCount()).toBe(before + 1);

    const dest = (
      await sql<{ name: string; category: string; origin: string; adm4_code: string; marine_area_code: string; verified_at: string | null; lat: number }>(
        `select name, category, origin, adm4_code, marine_area_code, verified_at::text as verified_at,
                extensions.st_y(location::extensions.geometry) as lat
         from destinations where slug = 'pantai-uji-usulan-0'`,
      )
    ).rows[0];
    expect(dest).toMatchObject({ name: "Pantai Uji Usulan 0", category: "pantai", origin: "usulan", adm4_code: adm4, marine_area_code: "P.N.02" });
    expect(dest.lat).toBeCloseTo(-8.25, 4);
    // Jam buka belum dikonfirmasi ke pengelola oleh admin -> tetap dianggap belum terverifikasi.
    expect(dest.verified_at).toBeNull();

    const [after] = await listMySubmissions(ALICE);
    expect(after).toMatchObject({ status: "disetujui", reviewNote: "Data lengkap.", destination: { slug: "pantai-uji-usulan-0" } });
    expect(after.reviewedAt).not.toBeNull();
    expect((await listPendingForReview(ADMIN)).length).toBe(0);
  });

  it("verified_at terisi hanya bila admin menegaskan jam buka sudah dikonfirmasi DAN ada jam buka", async () => {
    const withHours = await createSubmission(ALICE, input(0));
    const withoutHours = await createSubmission(ALICE, input(1, { openHours: null }));
    await approveSubmission(ADMIN, withHours.id, decision({ slug: "uji-a", hoursVerified: true }));
    await approveSubmission(ADMIN, withoutHours.id, decision({ slug: "uji-b", hoursVerified: true }));

    const rows = (await sql<{ slug: string; verified_at: string | null }>("select slug, verified_at::text from destinations where slug in ('uji-a','uji-b')")).rows;
    expect(rows.find((r) => r.slug === "uji-a")?.verified_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rows.find((r) => r.slug === "uji-b")?.verified_at).toBeNull();
  });

  it("slug yang sudah dipakai ditolak dan usulan tetap menunggu (transaksi dibatalkan)", async () => {
    const mine = await createSubmission(ALICE, input(0));
    const before = await destinationCount();
    await expect(approveSubmission(ADMIN, mine.id, decision({ slug: "keraton-yogyakarta" }))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringMatching(/Slug/),
    });
    expect(await destinationCount()).toBe(before);
    expect((await listMySubmissions(ALICE))[0].status).toBe("menunggu");
  });

  it("wilayah cuaca atau wilayah perairan yang tidak dikenal ditolak", async () => {
    const mine = await createSubmission(ALICE, input(0));
    await expect(approveSubmission(ADMIN, mine.id, decision({ adm4Code: "99.99.99.9999" }))).rejects.toMatchObject({
      message: expect.stringMatching(/Wilayah cuaca/),
    });
    await expect(approveSubmission(ADMIN, mine.id, decision({ marineAreaCode: "P.N.99" }))).rejects.toMatchObject({
      message: expect.stringMatching(/perairan/),
    });
    expect((await listMySubmissions(ALICE))[0].status).toBe("menunggu");
  });

  it("wilayah perairan hanya untuk kategori pantai", async () => {
    const mine = await createSubmission(ALICE, input(0, { category: "museum" }));
    await expect(approveSubmission(ADMIN, mine.id, decision({ marineAreaCode: "P.N.02" }))).rejects.toMatchObject({
      message: expect.stringMatching(/hanya untuk kategori pantai/),
    });
  });

  it("usulan yang sudah ditinjau tidak bisa disetujui lagi", async () => {
    const mine = await createSubmission(ALICE, input(0));
    await approveSubmission(ADMIN, mine.id, decision());
    await expect(approveSubmission(ADMIN, mine.id, decision({ slug: "pantai-uji-lain" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("menolak usulan", () => {
  it("menyimpan alasan, mengosongkan nomor WA, dan tidak membuat destinasi", async () => {
    const before = await destinationCount();
    const mine = await createSubmission(ALICE, input(0));
    await rejectSubmission(ADMIN, mine.id, "Titik tidak sesuai dengan alamat.");

    const [after] = await listMySubmissions(ALICE);
    expect(after).toMatchObject({ status: "ditolak", reviewNote: "Titik tidak sesuai dengan alamat.", contactWa: null, destination: null });
    expect(await destinationCount()).toBe(before);
    expect((await listRecentlyReviewed(ADMIN)).map((s) => s.status)).toEqual(["ditolak"]);
  });

  it("usulan yang sudah ditinjau tidak bisa ditolak lagi", async () => {
    const mine = await createSubmission(ALICE, input(0));
    await rejectSubmission(ADMIN, mine.id, "Alasan pertama.");
    await expect(rejectSubmission(ADMIN, mine.id, "Alasan kedua.")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("riwayat admin tidak memuat nomor WA", async () => {
    const mine = await createSubmission(ALICE, input(0));
    await approveSubmission(ADMIN, mine.id, decision());
    const [reviewed] = await listRecentlyReviewed(ADMIN);
    expect(reviewed.contactWa).toBeNull();
  });
});

describe("db:seed tidak menghapus destinasi dari usulan", () => {
  it("destinasi usulan (dan rencana yang memuatnya) bertahan; destinasi seed yang tak ada di berkas tetap dibersihkan", async () => {
    const mine = await createSubmission(ALICE, input(0));
    const { destinationId } = await approveSubmission(ADMIN, mine.id, decision());

    // Destinasi 'seed' yang sudah tidak ada di berkas JSON: harus hilang saat seed (perilaku rekan tim).
    await sql(
      `insert into destinations (slug, name, category, adm4_code, location)
       values ('zz-bukan-seed', 'Bukan Seed', 'alam', $1, extensions.st_setsrid(extensions.st_makepoint(110.4, -7.8), 4326)::extensions.geography)`,
      [adm4],
    );
    const trip = (await sql<{ id: string }>("insert into trips (user_id, title) values ($1, 'Rencana uji usulan') returning id", [ALICE])).rows[0];
    await sql("insert into trip_items (trip_id, destination_id) values ($1, $2)", [trip.id, destinationId]);

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await loadSeed(client);
    } finally {
      await client.end();
    }

    const slugs = (await sql<{ slug: string }>("select slug from destinations where slug in ('pantai-uji-usulan-0', 'zz-bukan-seed')")).rows.map((r) => r.slug);
    expect(slugs).toEqual(["pantai-uji-usulan-0"]);
    const items = await sql("select 1 from trip_items where trip_id = $1", [trip.id]);
    expect(items.rowCount).toBe(1);

    await sql("delete from trips where id = $1", [trip.id]);
  });
});
