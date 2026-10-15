// CLI: terapkan migrasi database. Logikanya ada di scripts/lib/migrate.ts.
import { Client } from "pg";
import { applyMigrations } from "./lib/migrate";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum diatur.");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const applied = await applyMigrations(client);
    for (const file of applied) console.log(`[migrate] diterapkan: ${file}`);
    console.log(applied.length ? `[migrate] ${applied.length} migrasi baru diterapkan` : "[migrate] skema sudah terbaru");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[migrate] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
