// CLI: jadikan pengguna admin peninjau usulan destinasi (atau cabut perannya).
//   npm run admin:grant -- email@contoh.com
//   npm run admin:grant -- email@contoh.com --revoke
// Pengguna harus sudah mendaftar lebih dulu (/masuk?mode=daftar).
import { Client } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum diatur.");

  const email = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const revoke = process.argv.includes("--revoke");
  if (!email) throw new Error("Pemakaian: npm run admin:grant -- email@contoh.com [--revoke]");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>("select id from auth.users where lower(email) = lower($1)", [email]);
    if (!rows[0]) throw new Error(`Pengguna "${email}" belum terdaftar. Daftar dulu lewat /masuk?mode=daftar.`);

    if (revoke) {
      const { rowCount } = await client.query("delete from admins where user_id = $1", [rows[0].id]);
      console.log(rowCount ? `[admin] peran admin ${email} dicabut` : `[admin] ${email} memang bukan admin`);
    } else {
      const { rowCount } = await client.query("insert into admins (user_id) values ($1) on conflict do nothing", [rows[0].id]);
      console.log(rowCount ? `[admin] ${email} sekarang admin` : `[admin] ${email} sudah menjadi admin`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[admin] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
