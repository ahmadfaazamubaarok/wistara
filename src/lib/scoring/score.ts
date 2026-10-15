// Skor kelayakan kunjungan per slot 3 jam:
//   S = max(0, 100 - (w_rain*P_rain + w_wind*P_wind + w_heat*P_heat + w_vis*P_vis))
// Fungsi murni tanpa akses jaringan/DB agar mudah diuji dan dibaca juri.

import { getScoreBand, SCORE_LABEL, type ScoreBand } from "../score-band";
import {
  heatPenalty,
  isKnownWeather,
  rainPenalty,
  visibilityPenalty,
  windPenalty,
} from "./penalties";

export type ScoreProfile = { wRain: number; wWind: number; wHeat: number; wVis: number };
export type WeatherInput = {
  weatherDesc: string | null;
  /** Suhu, derajat Celsius. */
  t: number | null;
  /** Kecepatan angin, km/jam. */
  ws: number | null;
};

export type PenaltyKey = "rain" | "wind" | "heat" | "vis";

export type SlotScore = {
  /** Bilangan bulat 0-100. */
  score: number;
  band: ScoreBand;
  label: string;
  /** Maksimal 3 alasan, penalti berbobot terbesar lebih dulu. */
  reasons: string[];
  /** Penalti SETELAH dibobot, per komponen (belum dibulatkan). */
  penalties: Record<PenaltyKey, number>;
  /** Komponen dengan penalti berbobot terbesar; null bila semuanya 0. */
  dominant: PenaltyKey | null;
};

export type ScoreHooks = {
  /** Dipanggil untuk teks `weather_desc` yang tidak ada di tabel penalti (penalti 0). */
  onUnknownWeather?: (description: string) => void;
};

/** Penalti berbobot harus lebih besar dari ini agar tampil sebagai alasan. */
export const REASON_THRESHOLD = 10;
export const MAX_REASONS = 3;

const PRIORITY: PenaltyKey[] = ["rain", "wind", "heat", "vis"]; // urutan saat nilai sama

function sentenceCase(text: string): string {
  const lower = text.trim().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function reasonText(key: PenaltyKey, input: WeatherInput, weighted: number): string {
  const amount = `(-${Math.round(weighted)})`;
  switch (key) {
    case "rain":
      return `${sentenceCase(input.weatherDesc ?? "")} diprakirakan ${amount}`;
    case "wind":
      return `Angin ${input.ws} km/jam ${amount}`;
    case "heat":
      return `Suhu ${input.t} °C ${amount}`;
    case "vis":
      return `${sentenceCase(input.weatherDesc ?? "")} mengurangi jarak pandang ${amount}`;
  }
}

export function scoreWeather(
  input: WeatherInput,
  profile: ScoreProfile,
  hooks: ScoreHooks = {},
): SlotScore {
  if (input.weatherDesc !== null && !isKnownWeather(input.weatherDesc)) {
    hooks.onUnknownWeather?.(input.weatherDesc);
  }

  const penalties: Record<PenaltyKey, number> = {
    rain: profile.wRain * rainPenalty(input.weatherDesc),
    wind: profile.wWind * windPenalty(input.ws),
    heat: profile.wHeat * heatPenalty(input.t),
    vis: profile.wVis * visibilityPenalty(input.weatherDesc),
  };

  const total = penalties.rain + penalties.wind + penalties.heat + penalties.vis;
  const score = Math.round(Math.max(0, 100 - total));
  const band = getScoreBand(score);

  const ranked = PRIORITY.map((key, order) => ({ key, order, value: penalties[key] }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.order - b.order);

  const reasons = ranked
    .filter((item) => item.value > REASON_THRESHOLD)
    .slice(0, MAX_REASONS)
    .map((item) => reasonText(item.key, input, item.value));

  return {
    score,
    band,
    label: SCORE_LABEL[band],
    reasons,
    penalties,
    dominant: ranked[0]?.key ?? null,
  };
}
