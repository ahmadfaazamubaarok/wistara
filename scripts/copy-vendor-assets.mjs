// Menyalin bundel pihak ketiga yang harus disajikan dari domain sendiri ke public/vendor:
//   - Scalar: penampil dokumentasi OpenAPI (/api/docs), tanpa CDN dan tanpa skrip inline.
//   - Web worker MapLibre: bundler tidak menemukan berkas worker-nya sendiri
//     (galat "Worker failed to load"), jadi lokasinya diberikan lewat setWorkerUrl().
// Dijalankan otomatis lewat "predev", "predev:docker", dan "prebuild".
//
// Mengapa bukan komponen React Scalar: kompilasi webpack-dev-nya memakan lebih dari
// 10 menit dan 2,6 GB memori di VM Docker 4 GB.

import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const ASSETS = [
  ["node_modules/@scalar/api-reference/dist/browser/standalone.js", "public/vendor/scalar-api-reference.js"],
  ["node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs"],
];

for (const [from, to] of ASSETS) {
  const source = path.resolve(from);
  const target = path.resolve(to);
  try {
    await stat(source);
  } catch {
    console.error(`[vendor-assets] ${from} tidak ada. Jalankan npm install dulu.`);
    process.exit(1);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`[vendor-assets] ${to} (${Math.round((await stat(target)).size / 1024)} KB)`);
}
