// Menyiapkan database uji sekali sebelum seluruh tes integrasi:
//   1. buat ulang database `jelajahlokal_test`
//   2. meniru lingkungan Supabase (docker/db/init/00-supabase-compat.sql)
//   3. terapkan migrasi, lalu muat data seed (20 destinasi + fasilitas OSM)
// DATABASE_URL lalu diarahkan ke database uji; proses worker mewarisinya.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { applyMigrations } from "../../scripts/lib/migrate";
import { loadSeed } from "../../scripts/lib/seed";

const TEST_DB = "jelajahlokal_test";
const adminUrl = process.env.DATABASE_URL;

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export async function setup() {
  if (!adminUrl) throw new Error("DATABASE_URL belum diatur. Jalankan tes di dalam container: docker compose exec app npm run test:int");

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const testUrl = withDatabase(adminUrl, TEST_DB);
  const client = new Client({ connectionString: testUrl });
  await client.connect();
  try {
    await client.query(await readFile(path.resolve("docker/db/init/00-supabase-compat.sql"), "utf8"));
    // Database dev memakai GoTrue sungguhan (membuat auth.users, auth.uid(), dst.). Database uji
    // tidak menjalankan GoTrue, jadi bagian yang dipakai skema kita ditiru minimal di sini.
    await client.query(`
      create table if not exists auth.users (
        id uuid primary key default gen_random_uuid(),
        email text unique
      );
      create or replace function auth.uid() returns uuid
      language sql stable
      as $$
        select coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        )::uuid
      $$;
    `);
    await applyMigrations(client);
    await loadSeed(client);
  } finally {
    await client.end();
  }

  process.env.DATABASE_URL = testUrl;
  process.env.CRON_SECRET = "test-cron-secret";
  // Pengaman: tes tidak boleh pernah memanggil BMKG sungguhan. Port 9 tertutup, jadi
  // pengambilan yang tidak disengaja gagal cepat (dan justru menguji jalur "BMKG gagal").
  process.env.BMKG_API_BASE_URL = "http://127.0.0.1:9/bmkg-uji";
  process.env.BMKG_MARINE_BASE_URL = "http://127.0.0.1:9/bmkg-marine-uji";
}

export async function teardown() {
  if (!adminUrl) return;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  } finally {
    await admin.end();
  }
}
