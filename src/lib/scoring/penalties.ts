// Penalti cuaca 0-100 (Rancangan Teknis, "Logika skor kelayakan kunjungan").
// SEMUA ambang di sini adalah ASUMSI DESAIN tim, bukan standar BMKG.

const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

export const RAIN_PENALTY: Record<string, number> = {
  cerah: 0,
  "cerah berawan": 0,
  berawan: 0,
  "berawan tebal": 10,
  "hujan ringan": 40,
  "hujan sedang": 70,
  "hujan lebat": 90,
  "hujan petir": 100,
};

export const VISIBILITY_PENALTY: Record<string, number> = {
  kabut: 60,
  asap: 60,
  "udara kabur": 60,
};

export const WIND_FREE_KMH = 15; // <= ini tidak ada penalti
export const WIND_MAX_KMH = 45; // >= ini penalti penuh
export const HEAT_FREE_C = 30;
export const HEAT_MAX_C = 36;

/** Interpolasi linear 0..100 antara `free` dan `max`, dijepit di kedua ujung. */
function linear(value: number, free: number, max: number): number {
  if (value <= free) return 0;
  if (value >= max) return 100;
  return ((value - free) / (max - free)) * 100;
}

/** True bila teks cuaca dikenali oleh salah satu tabel penalti. */
export function isKnownWeather(description: string | null): boolean {
  if (description === null) return true; // tidak ada data = tidak ada penalti, bukan "tidak dikenal"
  const key = normalize(description);
  return key in RAIN_PENALTY || key in VISIBILITY_PENALTY;
}

export function rainPenalty(description: string | null): number {
  return description === null ? 0 : (RAIN_PENALTY[normalize(description)] ?? 0);
}

export function visibilityPenalty(description: string | null): number {
  return description === null ? 0 : (VISIBILITY_PENALTY[normalize(description)] ?? 0);
}

export function windPenalty(speedKmh: number | null): number {
  return speedKmh === null ? 0 : linear(speedKmh, WIND_FREE_KMH, WIND_MAX_KMH);
}

export function heatPenalty(temperatureC: number | null): number {
  return temperatureC === null ? 0 : linear(temperatureC, HEAT_FREE_C, HEAT_MAX_C);
}
