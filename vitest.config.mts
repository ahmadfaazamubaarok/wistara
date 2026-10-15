import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Tes UNIT: cepat, tanpa database. Tes integrasi (*.int.test.ts) memakai
// vitest.int.config.mts dan dijalankan lewat `npm run test:int`.
export default defineConfig({
  resolve: {
    // Cermin dari "paths" di tsconfig.json: "@/*" -> "./src/*"
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "**/*.int.test.ts"],
  },
});
