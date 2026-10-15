import { Client, type QueryResultRow } from "pg";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as deleteItemRoute } from "@/app/api/v1/trips/[id]/items/[itemId]/route";
import { POST as addItemRoute } from "@/app/api/v1/trips/[id]/items/route";
import { DELETE as deleteTripRoute, PATCH as patchTripRoute } from "@/app/api/v1/trips/[id]/route";
import { GET as listTripsRoute, POST as createTripRoute } from "@/app/api/v1/trips/route";
import { addedItemSchema, errorSchema, tripListSchema, tripSchema } from "@/lib/api/schemas";
import { getPool } from "@/lib/db";
import { withUser } from "@/lib/trips/service";
import { send, withId, withItem } from "./helpers";

// Verifikator token diganti tiruan: database uji tidak menjalankan GoTrue. Seluruh akses DATA
// tetap lewat withUser() dan RLS sungguhan.
const { ALICE, BOB, USERS } = vi.hoisted(() => {
  const ALICE = "11111111-1111-4111-8111-111111111111";
  const BOB = "22222222-2222-4222-8222-222222222222";
  return {
    ALICE,
    BOB,
    USERS: {
      "token-alice": { id: ALICE, email: "alice@contoh.test" },
      "token-bob": { id: BOB, email: "bob@contoh.test" },
    } as Record<string, { id: string; email: string }>,
  };
});
vi.mock("@/lib/auth/verify", () => ({
  verifyAccessToken: async (token: string) => {
    if (token === "token-outage") throw new Error("layanan Auth mati");
    return USERS[token] ?? null;
  },
  AuthUnavailableError: class AuthUnavailableError extends Error {},
}));

const A = "token-alice";
const B = "token-bob";
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

let keraton: string;
let prambanan: string;

const expectError = (r: { status: number; json: unknown }, status: number, code: string) => {
  expect(r.status).toBe(status);
  expect(errorSchema.parse(r.json).error.code).toBe(code);
};

async function newTrip(token = A, title = "Rencana uji") {
  const r = await send(createTripRoute, "POST", "/api/v1/trips", { token, body: { title } });
  expect(r.status).toBe(201);
  return tripSchema.parse(r.json);
}

async function sql<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}

beforeAll(async () => {
  await sql("insert into auth.users (id, email) values ($1, 'alice@contoh.test'), ($2, 'bob@contoh.test') on conflict do nothing", [ALICE, BOB]);
  keraton = (await sql<{ id: string }>("select id from destinations where slug = 'keraton-yogyakarta'")).rows[0].id;
  prambanan = (await sql<{ id: string }>("select id from destinations where slug = 'candi-prambanan'")).rows[0].id;
});

beforeEach(async () => {
  await sql("truncate trips, trip_items, rate_limits cascade");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("autentikasi", () => {
  const routes = [
    ["GET /trips", () => send(listTripsRoute, "GET", "/api/v1/trips", {})],
    ["POST /trips", () => send(createTripRoute, "POST", "/api/v1/trips", { body: { title: "x" } })],
    ["PATCH /trips/{id}", () => send(patchTripRoute, "PATCH", "/x", { body: { title: "x" }, context: withId(ALICE) })],
    ["DELETE /trips/{id}", () => send(deleteTripRoute, "DELETE", "/x", { context: withId(ALICE) })],
    ["POST /trips/{id}/items", () => send(addItemRoute, "POST", "/x", { body: { destinationId: ALICE }, context: withId(ALICE) })],
    ["DELETE /trips/{id}/items/{itemId}", () => send(deleteItemRoute, "DELETE", "/x", { context: withItem(ALICE, ALICE) })],
  ] as const;

  it.each(routes)("%s tanpa login -> 401 dengan WWW-Authenticate", async (_name, run) => {
    const r = await run();
    expectError(r, 401, "UNAUTHORIZED");
    expect(r.headers.get("www-authenticate")).toBe("Bearer");
  });

  it("token tidak dikenal -> 401 invalid_token", async () => {
    const r = await send(listTripsRoute, "GET", "/api/v1/trips", { token: "token-palsu" });
    expectError(r, 401, "UNAUTHORIZED");
    expect(r.headers.get("www-authenticate")).toContain("invalid_token");
  });

  it("skema selain Bearer ditolak", async () => {
    const r = await send(listTripsRoute, "GET", "/api/v1/trips", { headers: { authorization: "Basic YWxpY2U6cHc=" } });
    expectError(r, 401, "UNAUTHORIZED");
  });

  it("layanan Auth mati -> 503, bukan 401 (pengguna tidak dianggap salah)", async () => {
    const r = await send(listTripsRoute, "GET", "/api/v1/trips", { token: "token-outage" });
    expectError(r, 503, "UPSTREAM_UNAVAILABLE");
  });
});

describe("membuat dan mengelola rencana", () => {
  it("membuat rencana (201) lalu muncul di daftar", async () => {
    const trip = await newTrip(A, "Pagi Parangtritis, sore museum");
    expect(trip).toMatchObject({ title: "Pagi Parangtritis, sore museum", items: [] });

    const list = tripListSchema.parse((await send(listTripsRoute, "GET", "/api/v1/trips", { token: A })).json);
    expect(list.trips.map((t) => t.id)).toEqual([trip.id]);
  });

  it("judul dipangkas spasinya dan boleh tepat 80 karakter", async () => {
    expect((await newTrip(A, "   rapi   ")).title).toBe("rapi");
    expect((await newTrip(A, "x".repeat(80))).title).toHaveLength(80);
  });

  it.each([
    ["kosong", { title: "" }],
    ["hanya spasi", { title: "    " }],
    ["81 karakter", { title: "x".repeat(81) }],
    ["tanpa title", {}],
    ["bukan teks", { title: 123 }],
    ["kolom tak dikenal", { title: "ok", isAdmin: true }],
    ["array", ["x"]],
  ])("judul tidak valid ditolak 400: %s", async (_name, body) => {
    expectError(await send(createTripRoute, "POST", "/api/v1/trips", { token: A, body }), 400, "VALIDATION_ERROR");
  });

  it.each([["bukan json"], [""], ["{"], ["x".repeat(10_001)]])("body rusak ditolak 400: %j", async (rawBody) => {
    expectError(await send(createTripRoute, "POST", "/api/v1/trips", { token: A, rawBody }), 400, "VALIDATION_ERROR");
  });

  it("mengubah judul (PATCH) dan menghapus (DELETE)", async () => {
    const trip = await newTrip();
    const renamed = await send(patchTripRoute, "PATCH", "/x", { token: A, body: { title: "Judul baru" }, context: withId(trip.id) });
    expect(renamed.status).toBe(200);
    expect(tripSchema.parse(renamed.json).title).toBe("Judul baru");

    const removed = await send(deleteTripRoute, "DELETE", "/x", { token: A, context: withId(trip.id) });
    expect(removed.status).toBe(204);
    expect(removed.text).toBe("");
    expectError(await send(deleteTripRoute, "DELETE", "/x", { token: A, context: withId(trip.id) }), 404, "NOT_FOUND");
  });

  it("id bukan UUID -> 400; UUID yang tidak ada -> 404", async () => {
    expectError(await send(patchTripRoute, "PATCH", "/x", { token: A, body: { title: "x" }, context: withId("1; drop table trips") }), 400, "VALIDATION_ERROR");
    expectError(await send(patchTripRoute, "PATCH", "/x", { token: A, body: { title: "x" }, context: withId(BOB) }), 404, "NOT_FOUND");
  });
});

describe("item rencana", () => {
  it("menambah destinasi dengan slot, urutannya bertambah", async () => {
    const trip = await newTrip();
    const first = await send(addItemRoute, "POST", "/x", { token: A, body: { destinationId: keraton, plannedSlot: inHours(24) }, context: withId(trip.id) });
    const second = await send(addItemRoute, "POST", "/x", { token: A, body: { destinationId: prambanan, plannedSlot: inHours(48) }, context: withId(trip.id) });
    expect(first.status).toBe(201);
    expect(addedItemSchema.parse(first.json).created).toBe(true);
    expect(second.status).toBe(201);

    const list = tripListSchema.parse((await send(listTripsRoute, "GET", "/api/v1/trips", { token: A })).json);
    expect(list.trips[0].items.map((i) => [i.destination.slug, i.position])).toEqual([
      ["keraton-yogyakarta", 0],
      ["candi-prambanan", 1],
    ]);
  });

  it("idempoten: destinasi + slot yang sama tidak digandakan (200, created=false)", async () => {
    const trip = await newTrip();
    const slot = inHours(24);
    const body = { destinationId: keraton, plannedSlot: slot };
    const one = await send(addItemRoute, "POST", "/x", { token: A, body, context: withId(trip.id) });
    const two = await send(addItemRoute, "POST", "/x", { token: A, body, context: withId(trip.id) });
    expect(two.status).toBe(200);
    expect(addedItemSchema.parse(two.json)).toEqual({ id: addedItemSchema.parse(one.json).id, created: false });
    expect((await sql("select 1 from trip_items")).rows).toHaveLength(1);
  });

  it("slot boleh kosong (belum memilih), dan dibedakan dari yang berslot", async () => {
    const trip = await newTrip();
    const noSlot = await send(addItemRoute, "POST", "/x", { token: A, body: { destinationId: keraton }, context: withId(trip.id) });
    const again = await send(addItemRoute, "POST", "/x", { token: A, body: { destinationId: keraton, plannedSlot: null }, context: withId(trip.id) });
    expect(noSlot.status).toBe(201);
    expect(again.status).toBe(200); // NULL dianggap sama dengan NULL
  });

  it.each([
    ["destinasi tidak dikenal", () => ({ destinationId: "33333333-3333-4333-8333-333333333333" })],
    ["destinationId bukan UUID", () => ({ destinationId: "keraton" })],
    ["tanpa destinationId", () => ({})],
    ["plannedSlot bukan ISO", () => ({ destinationId: keraton, plannedSlot: "besok" })],
    ["plannedSlot tanpa zona", () => ({ destinationId: keraton, plannedSlot: "2026-10-16T15:00:00" })],
    ["plannedSlot 10 hari lagi", () => ({ destinationId: keraton, plannedSlot: inHours(240) })],
    ["plannedSlot kemarin", () => ({ destinationId: keraton, plannedSlot: inHours(-30) })],
    ["kolom tak dikenal", () => ({ destinationId: keraton, plannedSlot: null, x: 1 })],
  ])("input tidak valid ditolak 400: %s", async (_name, makeBody) => {
    const trip = await newTrip();
    expectError(await send(addItemRoute, "POST", "/x", { token: A, body: makeBody(), context: withId(trip.id) }), 400, "VALIDATION_ERROR");
  });

  it("menghapus item; item yang tidak ada -> 404", async () => {
    const trip = await newTrip();
    const added = addedItemSchema.parse(
      (await send(addItemRoute, "POST", "/x", { token: A, body: { destinationId: keraton }, context: withId(trip.id) })).json,
    );
    expect((await send(deleteItemRoute, "DELETE", "/x", { token: A, context: withItem(trip.id, added.id) })).status).toBe(204);
    expectError(await send(deleteItemRoute, "DELETE", "/x", { token: A, context: withItem(trip.id, added.id) }), 404, "NOT_FOUND");
  });

  it("menghapus rencana ikut menghapus isinya (cascade)", async () => {
    const trip = await newTrip();
    await send(addItemRoute, "POST", "/x", { token: A, body: { destinationId: keraton }, context: withId(trip.id) });
    await send(deleteTripRoute, "DELETE", "/x", { token: A, context: withId(trip.id) });
    expect((await sql("select 1 from trip_items")).rows).toHaveLength(0);
  });
});

describe("isolasi antar pengguna (RLS)", () => {
  it("pengguna lain tidak bisa melihat, mengubah, menghapus, atau menambah ke rencana orang lain", async () => {
    const trip = await newTrip(A, "Rahasia Alice");
    const added = addedItemSchema.parse(
      (await send(addItemRoute, "POST", "/x", { token: A, body: { destinationId: keraton, plannedSlot: inHours(24) }, context: withId(trip.id) })).json,
    );

    // Bob mencoba SEMUA operasi pada rencana Alice: selalu 404 (tidak membocorkan keberadaannya).
    const bobList = tripListSchema.parse((await send(listTripsRoute, "GET", "/api/v1/trips", { token: B })).json);
    expect(bobList.trips).toEqual([]);
    expectError(await send(patchTripRoute, "PATCH", "/x", { token: B, body: { title: "diretas" }, context: withId(trip.id) }), 404, "NOT_FOUND");
    expectError(await send(deleteTripRoute, "DELETE", "/x", { token: B, context: withId(trip.id) }), 404, "NOT_FOUND");
    expectError(await send(addItemRoute, "POST", "/x", { token: B, body: { destinationId: prambanan }, context: withId(trip.id) }), 404, "NOT_FOUND");
    expectError(await send(deleteItemRoute, "DELETE", "/x", { token: B, context: withItem(trip.id, added.id) }), 404, "NOT_FOUND");

    // Data Alice utuh.
    const aliceList = tripListSchema.parse((await send(listTripsRoute, "GET", "/api/v1/trips", { token: A })).json);
    expect(aliceList.trips).toHaveLength(1);
    expect(aliceList.trips[0]).toMatchObject({ title: "Rahasia Alice" });
    expect(aliceList.trips[0].items).toHaveLength(1);
  });

  it("RLS bekerja di level SQL, terlepas dari kode API (defense in depth)", async () => {
    const trip = await newTrip(A, "Milik Alice");
    await send(addItemRoute, "POST", "/x", { token: A, body: { destinationId: keraton }, context: withId(trip.id) });

    await withUser(BOB, async (c) => {
      expect((await c.query("select * from trips")).rowCount).toBe(0);
      expect((await c.query("select * from trip_items")).rowCount).toBe(0);
      expect((await c.query("select * from trips where id = $1", [trip.id])).rowCount).toBe(0);
      expect((await c.query("update trips set title = 'diretas' where id = $1", [trip.id])).rowCount).toBe(0);
      expect((await c.query("delete from trips where id = $1", [trip.id])).rowCount).toBe(0);
      expect((await c.query("delete from trip_items")).rowCount).toBe(0);
    });

    // Menyisipkan atas nama Alice, atau ke rencana Alice, ditolak oleh WITH CHECK.
    await expect(withUser(BOB, (c) => c.query("insert into trips (user_id, title) values ($1, 'palsu')", [ALICE]))).rejects.toThrow(/row-level security/i);
    await expect(withUser(BOB, (c) => c.query("insert into trip_items (trip_id, destination_id) values ($1, $2)", [trip.id, keraton]))).rejects.toThrow(/row-level security/i);
    // Memindahkan rencana sendiri menjadi milik orang lain juga ditolak.
    const mine = await newTrip(B, "Milik Bob");
    await expect(withUser(BOB, (c) => c.query("update trips set user_id = $1 where id = $2", [ALICE, mine.id]))).rejects.toThrow(/row-level security/i);

    expect((await sql<{ title: string }>("select title from trips where id = $1", [trip.id])).rows[0].title).toBe("Milik Alice");
  });

  it("anon (tanpa login) tidak punya akses apa pun ke tabel rencana", async () => {
    await newTrip();
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("begin");
      await client.query("set local role anon");
      await expect(client.query("select * from trips")).rejects.toThrow(/permission denied/i);
      await client.query("rollback");
      await client.query("begin");
      await client.query("set local role anon");
      await expect(client.query("select * from trip_items")).rejects.toThrow(/permission denied/i);
      await client.query("rollback");
      await client.query("begin");
      await client.query("set local role anon");
      await expect(client.query("select * from rate_limits")).rejects.toThrow(/permission denied/i);
    } finally {
      await client.query("rollback").catch(() => undefined);
      await client.end();
    }
  });

  it("tanpa klaim pengguna, auth.uid() NULL sehingga tidak ada baris yang terlihat", async () => {
    await newTrip();
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      expect((await client.query("select * from trips")).rowCount).toBe(0);
    } finally {
      await client.query("rollback").catch(() => undefined);
      await client.end();
    }
  });
});

describe("batas jumlah dan pembatasan laju", () => {
  it("maksimal 50 rencana per pengguna (ditegakkan di database)", async () => {
    await sql("insert into trips (user_id, title) select $1, 'r' || g from generate_series(1, 50) g", [ALICE]);
    const r = await send(createTripRoute, "POST", "/api/v1/trips", { token: A, body: { title: "ke-51" } });
    expectError(r, 400, "VALIDATION_ERROR");
    expect(errorSchema.parse(r.json).error.message).toContain("50");
    // Bob tidak terpengaruh batas Alice.
    expect((await send(createTripRoute, "POST", "/api/v1/trips", { token: B, body: { title: "ok" } })).status).toBe(201);
  });

  it("maksimal 30 destinasi per rencana", async () => {
    const trip = await newTrip();
    await sql(
      `insert into trip_items (trip_id, destination_id, planned_slot, position)
       select $1, $2, now() + make_interval(hours => g), g from generate_series(1, 30) g`,
      [trip.id, keraton],
    );
    const r = await send(addItemRoute, "POST", "/x", { token: A, body: { destinationId: prambanan }, context: withId(trip.id) });
    expectError(r, 400, "VALIDATION_ERROR");
    expect(errorSchema.parse(r.json).error.message).toContain("30");
  });

  it("permintaan tulis ke-31 dalam semenit -> 429 dengan Retry-After; baca tidak dihitung", async () => {
    for (let i = 0; i < 30; i += 1) {
      const r = await send(createTripRoute, "POST", "/api/v1/trips", { token: A, body: { title: `r${i}` } });
      expect(r.status, `tulis ke-${i + 1}`).toBe(201);
    }
    const blocked = await send(createTripRoute, "POST", "/api/v1/trips", { token: A, body: { title: "terlalu banyak" } });
    expectError(blocked, 429, "RATE_LIMITED");
    const retryAfter = Number(blocked.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);

    // Membaca tidak terkena batas; pengguna lain tidak terpengaruh.
    expect((await send(listTripsRoute, "GET", "/api/v1/trips", { token: A })).status).toBe(200);
    expect((await send(createTripRoute, "POST", "/api/v1/trips", { token: B, body: { title: "bob" } })).status).toBe(201);
  });

  it("permintaan yang ditolak validasi (400) tidak menghabiskan jatah tulis", async () => {
    for (let i = 0; i < 40; i += 1) {
      expect((await send(createTripRoute, "POST", "/api/v1/trips", { token: A, body: { title: "" } })).status).toBe(400);
    }
    expect((await send(createTripRoute, "POST", "/api/v1/trips", { token: A, body: { title: "masih bisa" } })).status).toBe(201);
  });
});
