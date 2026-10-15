// Data path SVG (viewBox 24x24, stroke) untuk ikon kategori dan cuaca.
// Berupa data murni agar bisa dipakai komponen React maupun penanda peta (DOM).

import type { DestCategory } from "./categories";

export const CATEGORY_ICON_PATHS: Record<DestCategory, string[]> = {
  // ombak
  pantai: [
    "M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
    "M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
    "M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
  ],
  // gunung
  alam: ["m8 3 4 8 5-5 5 15H2L8 3z"],
  // candi bertingkat
  budaya: [
    "M12 3 9.5 7h5L12 3z",
    "M7.5 7h9l1.5 4.5H6L7.5 7z",
    "M5 11.5h14l1.5 5h-17l1.5-5z",
    "M3 16.5h18V21H3z",
  ],
  // gedung berpilar
  museum: ["M3 22h18", "M6 18v-7", "M10 18v-7", "M14 18v-7", "M18 18v-7", "M12 2 20 7H4z"],
  // rumah
  desa_wisata: ["m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"],
};

export type WeatherKind = "sun" | "cloud-sun" | "cloud" | "rain" | "storm" | "fog";

export const WEATHER_ICON_PATHS: Record<WeatherKind, string[]> = {
  sun: [
    "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
    "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41",
    "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41",
  ],
  "cloud-sun": [
    "M12 2v2", "m4.93 4.93 1.41 1.41", "M20 12h2", "m19.07 4.93-1.41 1.41",
    "M15.947 12.65a4 4 0 0 0-5.925-4.128",
    "M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z",
  ],
  cloud: ["M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"],
  rain: ["M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", "M16 14v6", "M8 14v6", "M12 16v6"],
  storm: ["M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973", "m13 12-3 5h4l-3 5"],
  fog: ["M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", "M16 17H7", "M17 21H9"],
};

/** Teks `weather_desc` BMKG -> jenis ikon. Teks tak dikenal dianggap berawan. */
export function weatherKind(description: string | null): WeatherKind {
  const text = (description ?? "").trim().toLowerCase();
  if (text === "cerah") return "sun";
  if (text === "cerah berawan" || text === "berawan") return "cloud-sun";
  if (text.includes("petir")) return "storm";
  if (text.includes("hujan")) return "rain";
  if (/kabut|asap|kabur/.test(text)) return "fog";
  return "cloud";
}
