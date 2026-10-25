"use client";

import { useState } from "react";
import { ScoreChip } from "@/components/score-chip";

type ExampleScenario = {
  id: string;
  tabLabel: string;
  destination: string;
  categoryLabel: string;
  location: string;
  timeSlot: string;
  isIndoor: boolean;
  weather: {
    desc: string;
    tempC: number;
    windKmh: number;
    visibility: string;
  };
  weights: {
    wRain: number;
    wWind: number;
    wHeat: number;
    wVis: number;
  };
  rawPenalties: {
    pRain: number;
    pWind: number;
    pHeat: number;
    pVis: number;
  };
  weightedPenalties: {
    wRain: number;
    wWind: number;
    wHeat: number;
    wVis: number;
  };
  totalPenalty: number;
  score: number;
  reasons: string[];
  explanation: string;
};

const SCENARIOS: ExampleScenario[] = [
  {
    id: "pantai-sore",
    tabLabel: "Pantai (Hujan & Angin)",
    destination: "Pantai Parangtritis",
    categoryLabel: "Pantai",
    location: "Parangtritis, Kretek, Bantul",
    timeSlot: "Pukul 15.00 WIB",
    isIndoor: false,
    weather: {
      desc: "Hujan Ringan",
      tempC: 31,
      windKmh: 25,
      visibility: "Normal (10 km)",
    },
    weights: {
      wRain: 1.0,
      wWind: 0.8,
      wHeat: 0.5,
      wVis: 0.3,
    },
    rawPenalties: {
      pRain: 40,
      pWind: 33.3,
      pHeat: 16.7,
      pVis: 0,
    },
    weightedPenalties: {
      wRain: 40.0,
      wWind: 26.7,
      wHeat: 8.3,
      wVis: 0.0,
    },
    totalPenalty: 75.0,
    score: 25,
    reasons: ["Hujan ringan diprakirakan (-40)", "Angin 25 km/jam (-27)"],
    explanation:
      "Contoh resmi di Rancangan Teknis. Pantai memiliki bobot hujan (1,0) dan angin (0,8) sangat tinggi. Angin 25 km/jam di pantai selatan berbahaya dan pasir beterbangan. Skor < 50 dengan penalti utama hujan otomatis memicu rekomendasi alternatif indoor (F5).",
  },
  {
    id: "pantai-pagi",
    tabLabel: "Pantai (Pagi Cerah)",
    destination: "Pantai Parangtritis",
    categoryLabel: "Pantai",
    location: "Parangtritis, Kretek, Bantul",
    timeSlot: "Pukul 09.00 WIB",
    isIndoor: false,
    weather: {
      desc: "Berawan",
      tempC: 28,
      windKmh: 12,
      visibility: "Normal (10 km)",
    },
    weights: {
      wRain: 1.0,
      wWind: 0.8,
      wHeat: 0.5,
      wVis: 0.3,
    },
    rawPenalties: {
      pRain: 0,
      pWind: 0,
      pHeat: 0,
      pVis: 0,
    },
    weightedPenalties: {
      wRain: 0,
      wWind: 0,
      wHeat: 0,
      wVis: 0,
    },
    totalPenalty: 0,
    score: 100,
    reasons: ["Kondisi ideal tanpa penalti cuaca"],
    explanation:
      "Contoh resmi di Rancangan Teknis. Suhu 28 °C di bawah ambang panas (≤ 30 °C), angin 12 km/jam di bawah batas bebas (≤ 15 km/jam), dan berawan tidak memicu penalti hujan (P=0). Skor sempurna 100.",
  },
  {
    id: "candi-siang",
    tabLabel: "Budaya (Siang Terik)",
    destination: "Candi Prambanan",
    categoryLabel: "Budaya",
    location: "Bokoharjo, Prambanan, Sleman",
    timeSlot: "Pukul 12.00 WIB",
    isIndoor: false,
    weather: {
      desc: "Cerah",
      tempC: 35,
      windKmh: 10,
      visibility: "Normal (10 km)",
    },
    weights: {
      wRain: 0.8,
      wWind: 0.1,
      wHeat: 0.8,
      wVis: 0.1,
    },
    rawPenalties: {
      pRain: 0,
      pWind: 0,
      pHeat: 83.3,
      pVis: 0,
    },
    weightedPenalties: {
      wRain: 0,
      wWind: 0,
      wHeat: 66.7,
      wVis: 0,
    },
    totalPenalty: 66.7,
    score: 33,
    reasons: ["Suhu 35 °C (-67)"],
    explanation:
      "Kompleks candi terbuka sangat sensitif terhadap sengatan matahari (bobot panas 0,8). Suhu 35 °C mendekati batas atas 36 °C menghasilkan penalti panas terbobot 66,7. Pengunjung disarankan datang pagi atau sore.",
  },
  {
    id: "museum-hujan",
    tabLabel: "Museum (Hujan Lebat)",
    destination: "Museum Sonobudoyo",
    categoryLabel: "Museum",
    location: "Ngupasan, Gondomanan, Kota Yogyakarta",
    timeSlot: "Pukul 15.00 WIB",
    isIndoor: true,
    weather: {
      desc: "Hujan Lebat",
      tempC: 26,
      windKmh: 20,
      visibility: "Normal (8 km)",
    },
    weights: {
      wRain: 0.1,
      wWind: 0.0,
      wHeat: 0.1,
      wVis: 0.0,
    },
    rawPenalties: {
      pRain: 90,
      pWind: 16.7,
      pHeat: 0,
      pVis: 0,
    },
    weightedPenalties: {
      wRain: 9.0,
      wWind: 0.0,
      wHeat: 0.0,
      wVis: 0.0,
    },
    totalPenalty: 9.0,
    score: 91,
    reasons: ["Pameran tertutup ber-AC terlindung dari cuaca"],
    explanation:
      "Museum sepenuhnya berada di dalam ruangan sehingga bobot cuaca luar sangat kecil (wRain = 0,1; wWind = 0). Walaupun di luar hujan lebat (penalti mentah 90), setelah dibobot hanya mengurangi 9 poin. Skor tetap 91 (Sangat sesuai).",
  },
];

export function FormulaCalculator() {
  const [activeId, setActiveId] = useState<string>("pantai-sore");
  const s = SCENARIOS.find((item) => item.id === activeId) ?? SCENARIOS[0];

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-hairline bg-surface-card/60 p-5 shadow-xs md:p-6">
      {/* Header & Tab Selector */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-link">
            Contoh Perhitungan Nyata
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Pilih skenario destinasi untuk melihat simulasi penalti BMKG
          </p>
        </div>

        {/* Tab Pills */}
        <div
          role="tablist"
          aria-label="Pilihan contoh destinasi"
          className="flex flex-wrap gap-1.5"
        >
          {SCENARIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === activeId}
              onClick={() => setActiveId(item.id)}
              className={`rounded-pill px-3 py-1.5 text-[13px] font-medium transition-all focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 ${
                item.id === activeId
                  ? "bg-surface-dark text-on-dark shadow-xs"
                  : "border border-border-input bg-canvas text-body hover:bg-surface-soft hover:text-ink"
              }`}
            >
              {item.tabLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Info Destinasi Terpilih */}
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-[20px] font-semibold text-ink">{s.destination}</h3>
            <span className="rounded-md bg-surface-soft px-2 py-0.5 text-[12px] font-medium text-muted">
              {s.categoryLabel}
            </span>
            {s.isIndoor && (
              <span className="rounded-md bg-score-good-bg px-2 py-0.5 text-[12px] font-medium text-score-good-text">
                Indoor
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {s.location} · <span className="font-medium text-ink">{s.timeSlot}</span>
          </p>
        </div>

        {/* Ringkasan Input Cuaca BMKG */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-soft/80 px-3 py-1.5 text-[13px] tabular-nums text-body">
          <span>{s.weather.desc}</span>
          <span className="text-muted">·</span>
          <span>{s.weather.tempC} °C</span>
          <span className="text-muted">·</span>
          <span>Angin {s.weather.windKmh} km/j</span>
        </div>
      </div>

      {/* Rincian Hitungan Matematika */}
      <div className="mt-6 space-y-2 font-mono text-[13px] leading-relaxed">
        <div className="flex items-center justify-between text-muted">
          <span>Nilai dasar slot awal</span>
          <span className="font-bold text-ink">100,0</span>
        </div>

        {/* Baris Penalti Hujan */}
        <div className="flex items-center justify-between text-body">
          <span>
            − Penalti Hujan{" "}
            <span className="text-[12px] text-muted">
              (w: {s.weights.wRain.toFixed(1)} × P: {s.rawPenalties.pRain.toFixed(1)})
            </span>
          </span>
          <span className={s.weightedPenalties.wRain > 0 ? "font-semibold text-score-bad-text" : "text-muted"}>
            {s.weightedPenalties.wRain > 0 ? `−${s.weightedPenalties.wRain.toFixed(1)}` : "0,0"}
          </span>
        </div>

        {/* Baris Penalti Angin */}
        <div className="flex items-center justify-between text-body">
          <span>
            − Penalti Angin{" "}
            <span className="text-[12px] text-muted">
              (w: {s.weights.wWind.toFixed(1)} × P: {s.rawPenalties.pWind.toFixed(1)})
            </span>
          </span>
          <span className={s.weightedPenalties.wWind > 0 ? "font-semibold text-score-bad-text" : "text-muted"}>
            {s.weightedPenalties.wWind > 0 ? `−${s.weightedPenalties.wWind.toFixed(1)}` : "0,0"}
          </span>
        </div>

        {/* Baris Penalti Panas */}
        <div className="flex items-center justify-between text-body">
          <span>
            − Penalti Panas{" "}
            <span className="text-[12px] text-muted">
              (w: {s.weights.wHeat.toFixed(1)} × P: {s.rawPenalties.pHeat.toFixed(1)})
            </span>
          </span>
          <span className={s.weightedPenalties.wHeat > 0 ? "font-semibold text-score-bad-text" : "text-muted"}>
            {s.weightedPenalties.wHeat > 0 ? `−${s.weightedPenalties.wHeat.toFixed(1)}` : "0,0"}
          </span>
        </div>

        {/* Baris Penalti Jarak Pandang */}
        <div className="flex items-center justify-between text-body">
          <span>
            − Penalti Jarak Pandang{" "}
            <span className="text-[12px] text-muted">
              (w: {s.weights.wVis.toFixed(1)} × P: {s.rawPenalties.pVis.toFixed(1)})
            </span>
          </span>
          <span className={s.weightedPenalties.wVis > 0 ? "font-semibold text-score-bad-text" : "text-muted"}>
            {s.weightedPenalties.wVis > 0 ? `−${s.weightedPenalties.wVis.toFixed(1)}` : "0,0"}
          </span>
        </div>

        {/* Garis Pembatas */}
        <div className="border-t border-hairline pt-2" />

        {/* Total Penalti */}
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Total pengurangan penalti</span>
          <span className="font-semibold text-score-bad-text tabular-nums">
            −{s.totalPenalty.toFixed(1)} poin
          </span>
        </div>
      </div>

      {/* Kotak Hasil Akhir */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-hairline bg-surface-soft p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Hasil Akhir Di Aplikasi
          </p>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-serif text-[32px] font-bold tabular-nums text-ink">
              {s.score}
            </span>
            <ScoreChip score={s.score} />
          </div>
        </div>

        {/* Alasan yang tampil di kartu */}
        <div className="max-w-[340px] text-right sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Alasan Di Balik Skor
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {s.reasons.map((r) => (
              <span
                key={r}
                className="rounded-md bg-canvas px-2 py-0.5 text-[12px] font-medium text-body border border-hairline"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Catatan Penjelas */}
      <p className="mt-4 text-[13px] leading-relaxed text-muted">
        <strong>Mengapa demikian?</strong> {s.explanation}
      </p>
    </div>
  );
}
