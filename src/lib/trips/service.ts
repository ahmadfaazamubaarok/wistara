// Rencana kunjungan (F7). SEMUA akses data berjalan sebagai role `authenticated` dengan klaim
// JWT pengguna, sehingga Row Level Security di database yang membatasi akses, bukan filter di
// kode ini. Kueri di bawah sengaja TIDAK menyaring user_id: bila ada bug di sini, pengguna tetap
// tidak bisa menyentuh data orang lain (dibuktikan oleh tes integrasi).

import type { PoolClient } from "pg";
import { ApiError } from "../api/errors";
import type { DestCategory } from "../categories";
import { getPool } from "../db";

export type TripItem = {
  id: string;
  destination: { id: string; slug: string; name: string; category: DestCategory };
  /** Awal slot 3 jam (ISO UTC); null bila belum memilih slot. */
  plannedSlot: string | null;
  position: number;
};
export type Trip = { id: string; title: string; createdAt: string; items: TripItem[] };

/** Slot rencana harus berada dalam jangkauan prakiraan: sedikit ke belakang, sampai 4 hari ke depan. */
const SLOT_PAST_MS = 6 * 3_600_000;
const SLOT_FUTURE_MS = 4 * 24 * 3_600_000;

/**
 * Menjalankan `run` dalam satu transaksi sebagai pengguna tertentu. Mirip yang dilakukan PostgREST di
 * Supabase: klaim JWT dipasang per transaksi lalu role diganti ke `authenticated`.
 */
export async function withUser<T>(userId: string, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `select set_config('request.jwt.claim.sub', $1, true),
              set_config('request.jwt.claim.role', 'authenticated', true),
              set_config('request.jwt.claims', $2, true)`,
      [userId, JSON.stringify({ sub: userId, role: "authenticated" })],
    );
    await client.query("set local role authenticated");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw mapDatabaseError(error);
  } finally {
    client.release();
  }
}

function mapDatabaseError(error: unknown): unknown {
  const pg = error as { code?: string; hint?: string; message?: string };
  if (pg?.code === "P0001" && (pg.hint === "LIMIT_TRIPS" || pg.hint === "LIMIT_ITEMS")) {
    return new ApiError("VALIDATION_ERROR", pg.message ?? "Batas tercapai");
  }
  return error;
}

type TripRow = { id: string; title: string; created_at: Date };
const toTrip = (row: TripRow, items: TripItem[] = []): Trip => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at.toISOString(),
  items,
});

export function listTrips(userId: string): Promise<Trip[]> {
  return withUser(userId, async (client) => {
    const trips = (await client.query<TripRow>("select id, title, created_at from trips order by created_at desc")).rows;
    if (trips.length === 0) return [];

    const items = (
      await client.query<{
        id: string; trip_id: string; planned_slot: Date | null; position: number;
        destination_id: string; slug: string; name: string; category: DestCategory;
      }>(
        `select i.id, i.trip_id, i.planned_slot, i.position,
                d.id as destination_id, d.slug, d.name, d.category
         from trip_items i join destinations d on d.id = i.destination_id
         order by i.position, i.created_at`,
      )
    ).rows;

    const byTrip = new Map<string, TripItem[]>();
    for (const row of items) {
      const list = byTrip.get(row.trip_id) ?? [];
      list.push({
        id: row.id,
        destination: { id: row.destination_id, slug: row.slug, name: row.name, category: row.category },
        plannedSlot: row.planned_slot?.toISOString() ?? null,
        position: row.position,
      });
      byTrip.set(row.trip_id, list);
    }
    return trips.map((trip) => toTrip(trip, byTrip.get(trip.id) ?? []));
  });
}

export function createTrip(userId: string, title: string): Promise<Trip> {
  return withUser(userId, async (client) => {
    const { rows } = await client.query<TripRow>(
      "insert into trips (user_id, title) values ($1, $2) returning id, title, created_at",
      [userId, title],
    );
    return toTrip(rows[0]);
  });
}

export function renameTrip(userId: string, tripId: string, title: string): Promise<Trip> {
  return withUser(userId, async (client) => {
    const { rows } = await client.query<TripRow>(
      "update trips set title = $2 where id = $1 returning id, title, created_at",
      [tripId, title],
    );
    if (rows.length === 0) throw new ApiError("NOT_FOUND", "Rencana tidak ditemukan");
    return toTrip(rows[0]);
  });
}

export function deleteTrip(userId: string, tripId: string): Promise<void> {
  return withUser(userId, async (client) => {
    const { rowCount } = await client.query("delete from trips where id = $1", [tripId]);
    if (!rowCount) throw new ApiError("NOT_FOUND", "Rencana tidak ditemukan");
  });
}

export function addTripItem(
  userId: string,
  tripId: string,
  destinationId: string,
  plannedSlot: Date | null,
  now = new Date(),
): Promise<{ id: string; created: boolean }> {
  if (plannedSlot) {
    const delta = plannedSlot.getTime() - now.getTime();
    if (delta < -SLOT_PAST_MS || delta > SLOT_FUTURE_MS) {
      throw new ApiError("VALIDATION_ERROR", "plannedSlot di luar jangkauan prakiraan (maksimal 4 hari ke depan)");
    }
  }

  return withUser(userId, async (client) => {
    // Dengan RLS, rencana milik orang lain tidak terlihat sama sekali: hasilnya 404, bukan 403.
    const trip = await client.query("select 1 from trips where id = $1", [tripId]);
    if (trip.rowCount === 0) throw new ApiError("NOT_FOUND", "Rencana tidak ditemukan");

    const destination = await client.query("select 1 from destinations where id = $1", [destinationId]);
    if (destination.rowCount === 0) throw new ApiError("VALIDATION_ERROR", "destinationId tidak dikenal");

    const position = (
      await client.query<{ next: number }>("select coalesce(max(position), -1) + 1 as next from trip_items where trip_id = $1", [tripId])
    ).rows[0].next;

    const inserted = await client.query<{ id: string }>(
      `insert into trip_items (trip_id, destination_id, planned_slot, position)
       values ($1, $2, $3, $4)
       on conflict (trip_id, destination_id, planned_slot) do nothing
       returning id`,
      [tripId, destinationId, plannedSlot?.toISOString() ?? null, position],
    );
    if (inserted.rows[0]) return { id: inserted.rows[0].id, created: true };

    // Sudah ada: perlakukan sebagai idempoten dan kembalikan item yang ada.
    const existing = await client.query<{ id: string }>(
      `select id from trip_items
       where trip_id = $1 and destination_id = $2 and planned_slot is not distinct from $3`,
      [tripId, destinationId, plannedSlot?.toISOString() ?? null],
    );
    return { id: existing.rows[0].id, created: false };
  });
}

export function deleteTripItem(userId: string, tripId: string, itemId: string): Promise<void> {
  return withUser(userId, async (client) => {
    const { rowCount } = await client.query("delete from trip_items where id = $1 and trip_id = $2", [itemId, tripId]);
    if (!rowCount) throw new ApiError("NOT_FOUND", "Item rencana tidak ditemukan");
  });
}
