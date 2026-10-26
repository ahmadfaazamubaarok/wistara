"use client";

import { useState } from "react";
import { MiscIcon } from "@/components/icons";
import { BAND_COLOR, SCORE_LABEL, SCORE_RANGE, type ScoreBand } from "@/lib/score-band";

const BANDS: ScoreBand[] = ["good", "mid", "bad", "closed"];

type MapLegendProps = {
  className?: string;
  defaultExpanded?: boolean;
};

export function MapLegend({ className = "", defaultExpanded = false }: MapLegendProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`pointer-events-auto absolute right-3 top-3 z-10 select-none md:right-4 md:top-4 ${className}`}
    >
      <div
        role={!isExpanded ? "button" : undefined}
        tabIndex={!isExpanded ? 0 : undefined}
        aria-expanded={isExpanded}
        aria-label={!isExpanded ? "Legenda: tampilkan keterangan warna kesesuaian cuaca" : undefined}
        onKeyDown={
          !isExpanded
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsExpanded(true);
                }
              }
            : undefined
        }
        onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
        className={`relative overflow-hidden border border-hairline/90 bg-canvas/95 backdrop-blur-md transition-[width,height,border-radius,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-surface-card/95 dark:shadow-black/25 ${
          isExpanded
            ? "w-52 rounded-[14px] p-3 shadow-lg shadow-ink/5"
            : "w-[116px] cursor-pointer rounded-[18px] px-3 py-1.5 shadow-md shadow-ink/5 hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-focus"
        }`}
        style={{
          height: isExpanded ? "172px" : "36px",
        }}
      >
        {/* Tampilan Ringkas saat Diciutkan (Collapsed Pill) */}
        <div
          className={`absolute inset-0 flex items-center justify-between px-3 transition-opacity duration-150 ease-out ${
            isExpanded
              ? "pointer-events-none opacity-0"
              : "opacity-100 delay-100"
          }`}
          aria-hidden={isExpanded}
        >
          <div className="flex -space-x-1" aria-hidden="true">
            <span
              className="h-2.5 w-2.5 rounded-full border border-white shadow-xs dark:border-canvas"
              style={{ backgroundColor: BAND_COLOR.good }}
            />
            <span
              className="h-2.5 w-2.5 rounded-full border border-white shadow-xs dark:border-canvas"
              style={{ backgroundColor: BAND_COLOR.mid }}
            />
            <span
              className="h-2.5 w-2.5 rounded-full border border-white shadow-xs dark:border-canvas"
              style={{ backgroundColor: BAND_COLOR.bad }}
            />
          </div>
          <span className="text-xs font-medium text-ink">Legenda</span>
          <MiscIcon name="chevronDown" size={12} className="text-muted" />
        </div>

        {/* Tampilan Penuh saat Terbuka (Expanded Card) */}
        <section
          aria-label="Keterangan warna kesesuaian cuaca destinasi"
          className={`flex flex-col transition-opacity duration-200 ease-out ${
            isExpanded
              ? "opacity-100 delay-75"
              : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!isExpanded}
        >
          <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-hairline pb-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <h2 className="text-xs font-semibold tracking-tight text-ink">
                Kesesuaian Cuaca
              </h2>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="flex h-5 w-5 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
              title="Sembunyikan keterangan warna"
              aria-label="Sembunyikan keterangan warna"
            >
              <MiscIcon name="chevronUp" size={14} />
            </button>
          </div>

          <ul className="flex flex-col gap-1.5" role="list">
            {BANDS.map((band) => {
              const label = SCORE_LABEL[band];
              const range = SCORE_RANGE[band];
              const color = BAND_COLOR[band];

              return (
                <li
                  key={band}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-white shadow-xs dark:border-canvas"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium text-ink">
                      {label}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    {range}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
