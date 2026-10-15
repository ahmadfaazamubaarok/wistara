// GET /api/docs: dokumentasi interaktif OpenAPI (Scalar).
// Halaman ini HTML statis tanpa skrip inline; bundel Scalar disajikan dari
// /vendor/scalar-api-reference.js (disalin saat build). Konfigurasi lewat
// atribut data- agar CSP tidak perlu mengizinkan skrip inline.

export const dynamic = "force-static";

// telemetry/withDefaultFonts dimatikan: tidak ada panggilan ke pihak luar.
const configuration = JSON.stringify({
  telemetry: false,
  withDefaultFonts: false,
  hideClientButton: true,
  // Menu "Share/Deploy/Generate SDK/Ask AI" mengarah ke layanan cloud Scalar, bukan bagian produk ini.
  showDeveloperTools: "never",
  mcp: { disabled: true },
  forceDarkModeState: "light",
  hideDarkModeToggle: true,
  metaData: { title: "Dokumentasi API · JelajahLokal" },
});

const html = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dokumentasi API · JelajahLokal</title>
    <meta name="description" content="Dokumentasi interaktif API publik JelajahLokal (OpenAPI 3.1)." />
  </head>
  <body>
    <script id="api-reference" data-url="/api/openapi.json" data-configuration='${configuration}'></script>
    <script src="/vendor/scalar-api-reference.js"></script>
  </body>
</html>
`;

export function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
