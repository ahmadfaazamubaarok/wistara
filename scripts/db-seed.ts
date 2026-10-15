// CLI: muat data seed ke database. Logikanya ada di scripts/lib/seed.ts.
//   npm run db:seed                 -> selalu muat (idempoten)
//   npm run db:seed -- --if-empty   -> hanya bila tabel destinations kosong
import { Client } from "pg";
import { loadSeed } from "./lib/seed";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum diatur.");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (process.argv.includes("--if-empty")) {
      const { rows } = await client.query<{ n: string }>("select count(*)::text as n from destinations");
      if (Number(rows[0].n) > 0) {
        console.log(`[seed] destinations sudah berisi ${rows[0].n} baris, dilewati (pakai tanpa --if-empty untuk memaksa)`);
        return;
      }
    }
    const counts = await loadSeed(client);
    console.log(`[seed] ${counts.regions} wilayah, ${counts.destinations} destinasi, ${counts.facilities} fasilitas dimuat`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[seed] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
