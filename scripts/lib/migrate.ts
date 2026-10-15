// Menerapkan supabase/migrations/*.sql berurutan. Riwayatnya disimpan di
// supabase_migrations.schema_migrations, tabel yang sama dengan Supabase CLI,
// sehingga `supabase db push` ke proyek produksi nanti tidak mengulang migrasi.
// Dipakai oleh CLI (scripts/db-migrate.ts) dan oleh tes integrasi.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Client } from "pg";

// Kunci advisory lock: mencegah dua proses migrasi berjalan bersamaan.
const LOCK_KEY = 727274;

export const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

/** @returns nama berkas migrasi yang baru diterapkan, berurutan. */
export async function applyMigrations(client: Client, dir = MIGRATIONS_DIR): Promise<string[]> {
  await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
  try {
    await client.query("create schema if not exists supabase_migrations");
    await client.query(`
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        statements text[],
        name text
      )`);

    const { rows } = await client.query<{ version: string }>(
      "select version from supabase_migrations.schema_migrations",
    );
    const applied = new Set(rows.map((row) => row.version));

    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const appliedNow: string[] = [];

    for (const file of files) {
      const match = /^(\d+)_(.+)\.sql$/.exec(file);
      if (!match) throw new Error(`Nama migrasi tidak valid: ${file} (harus <versi>_<nama>.sql)`);
      const [, version, name] = match;
      if (applied.has(version)) continue;

      const sql = await readFile(path.join(dir, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)",
          [version, [sql], name],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Migrasi ${file} gagal: ${error instanceof Error ? error.message : error}`);
      }
      appliedNow.push(file);
    }
    return appliedNow;
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
  }
}
