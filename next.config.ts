import type { NextConfig } from "next";

// Host selain localhost yang boleh memuat aset dev server (mis. ponsel di Wi-Fi
// yang sama saat uji Chrome Android). Diisi lewat .env, dipisah koma.
const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";

function originOf(url: string | undefined, fallback?: string): string | null {
  try {
    return new URL(url || fallback || "").origin;
  } catch {
    return null;
  }
}

// Satu-satunya asal eksternal yang boleh dihubungi browser: server tile peta dan
// (setelah login diaktifkan) Supabase Auth. BMKG dan Overpass TIDAK ada di daftar
// ini karena hanya dipanggil oleh server.
const mapOrigin = originOf(process.env.NEXT_PUBLIC_MAP_STYLE_URL, "https://tiles.openfreemap.org/styles/positron");
const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const external = [mapOrigin, supabaseOrigin].filter((origin): origin is string => origin !== null);

// 'unsafe-inline' pada script diperlukan oleh data hidrasi inline Next.js tanpa nonce.
// Risiko XSS tetap dibatasi: tidak ada HTML dari pengguna, React meng-escape semua teks,
// dan asal eksternal dibatasi seperti di atas. Meningkatkan ke CSP ber-nonce = pekerjaan lanjutan.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${external.join(" ")}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${external.join(" ")}${isProduction ? "" : " ws: wss:"}`.trim(),
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
  { key: "X-Frame-Options", value: "DENY" },
  ...(isProduction ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : []),
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Bundel pihak ketiga hasil salinan (Scalar, worker MapLibre): boleh di-cache sebentar.
      {
        source: "/vendor/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
