import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tes INTEGRASI: berjalan melawan PostgreSQL + PostGIS sungguhan (database
// terpisah `jelajahlokal_test`, dibuat ulang setiap kali oleh global-setup).
// Jalankan di dalam container: docker compose exec app npm run test:int
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    // Satu database bersama: berkas tes dijalankan berurutan agar tidak saling mengganggu.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
