import { Pool } from "pg";

// Satu pool per proses. Di mode dev modul ini dievaluasi ulang saat hot reload,
// jadi pool disimpan di globalThis agar koneksi tidak menumpuk.
const globalForPool = globalThis as typeof globalThis & { __pgPool?: Pool };

export function getPool(): Pool {
  if (globalForPool.__pgPool) return globalForPool.__pgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL belum diatur. Jalankan lewat `docker compose up` atau salin .env.example ke .env.",
    );
  }

  const max = Number(process.env.DB_POOL_MAX || "15");
  const connectionTimeoutMillis = Number(process.env.DB_CONNECTION_TIMEOUT_MS || "10000");
  const pool = new Pool({
    connectionString,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis: 30000,
  });
  // Tanpa handler ini, koneksi idle yang putus (mis. DB di-restart) memicu
  // 'error' yang tidak tertangani dan mematikan proses.
  pool.on("error", (error) => {
    console.error("[db] koneksi idle error:", error.message);
  });

  globalForPool.__pgPool = pool;
  return pool;
}
