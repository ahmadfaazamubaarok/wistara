"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AttributionBar } from "@/components/attribution-bar";
import { CategoryIcon, MiscIcon } from "@/components/icons";
import { MapView, type MapMarker } from "@/components/map/map-view";
import { ScoreChip } from "@/components/score-chip";
import { StatusBanner } from "@/components/ui";
import { CATEGORY_LABEL, DEST_CATEGORIES, type DestCategory } from "@/lib/categories";
import { formatDayKey, formatWibDateTime, relativeDayName, slotHour } from "@/lib/format";
import { bestOverlappingSlot } from "@/lib/forecast/slots";
import type { ScoreBand } from "@/lib/score-band";

export type HomeSlotItem = {
  validAt: string;
  localTime: string;
  isOpen: boolean;
  score: number | null;
  label: string;
  band: ScoreBand;
  weatherDesc: string | null;
  t: number | null;
};

export type HomeItem = {
  slug: string;
  name: string;
  category: DestCategory;
  lat: number;
  lon: number;
  kabupaten: string;
  /** Selaras dengan `days`; null = tidak ada slot buka pada hari itu. */
  bestByDay: ({ localTime: string; score: number; label: string; band: ScoreBand } | null)[];
  /** Seluruh slot 3-jam untuk pengurutan jam spesifik (F11). */
  slots?: HomeSlotItem[];
  /** False bila prakiraan BMKG belum pernah tersimpan untuk destinasi ini. */
  hasForecast: boolean;
};

type Props = {
  items: HomeItem[];
  days: string[];
  source: { isStale: boolean; fetchedAt: string | null } | null;
  mapStyleUrl: string;
};

type Sheet = "collapsed" | "half" | "full";
const SHEET_ORDER: Sheet[] = ["collapsed", "half", "full"];

// Jam acuan standar kunjungan wisata (3-jam): pagi, siang, sore, malam.
const STANDARD_HOURS = ["06.00", "09.00", "12.00", "15.00", "18.00", "21.00"] as const;

// Warna status = warna teks pada token desain (kontras >= 3:1 pada peta).
const BAND_COLOR: Record<ScoreBand, string> = {
  good: "#1a6b4f",
  mid: "#8a5a00",
  bad: "#b3261e",
  closed: "#66635c",
};

function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(min-width: 768px)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
}

export function HomeExplorer({ items, days, source, mapStyleUrl }: Props) {
  const [categories, setCategories] = useState<DestCategory[]>([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>("half");
  const isDesktop = useIsDesktop();
  const listRef = useRef<HTMLUListElement>(null);

  const currentDayKey = days[dayIndex];

  // Evaluasi status destinasi sesuai mode (Waktu Terbaik vs Slot Jam Spesifik)
  const getItemEvaluation = useCallback(
    (item: HomeItem) => {
      if (!selectedHour || !currentDayKey) {
        const best = item.bestByDay[dayIndex];
        return {
          score: best?.score ?? null,
          band: best?.band ?? "closed",
          label: best?.label ?? (item.hasForecast ? "Tutup" : "Prakiraan belum tersedia"),
          isOpen: Boolean(best),
          timeText: best
            ? `terbaik pukul ${slotHour(best.localTime)}`
            : item.hasForecast
              ? "Tidak ada slot buka pada hari ini"
              : "Prakiraan belum tersedia",
          weatherDesc: null,
          t: null,
          sortScore: best?.score ?? -1,
        };
      }

      // Cocokkan ke slot yang paling tumpang-tindih dengan jam acuan WIB yang dipilih
      const targetIso = `${currentDayKey}T${selectedHour.replace(".", ":")}:00+07:00`;
      const targetMs = new Date(targetIso).getTime();
      const slot = item.slots?.length ? bestOverlappingSlot(item.slots, targetMs) : undefined;

      if (!slot) {
        return {
          score: null,
          band: "closed" as ScoreBand,
          label: "Tidak ada prakiraan",
          isOpen: false,
          timeText: item.hasForecast ? `Tidak ada jadwal pukul ${selectedHour}` : "Prakiraan belum tersedia",
          weatherDesc: null,
          t: null,
          sortScore: -1,
        };
      }

      return {
        score: slot.score,
        band: slot.band,
        label: slot.label,
        isOpen: slot.isOpen,
        timeText: slot.isOpen ? `pukul ${slotHour(slot.localTime)}` : "Tutup pada jam ini",
        weatherDesc: slot.weatherDesc,
        t: slot.t,
        sortScore: slot.isOpen && slot.score !== null ? slot.score : -1,
      };
    },
    [selectedHour, currentDayKey, dayIndex],
  );

  const visible = useMemo(() => {
    const filtered = categories.length ? items.filter((item) => categories.includes(item.category)) : items;
    // Skor tertinggi di hari/slot terpilih lebih dulu; tanpa slot buka di paling bawah.
    return [...filtered].sort((a, b) => {
      const evalA = getItemEvaluation(a);
      const evalB = getItemEvaluation(b);
      return evalB.sortScore - evalA.sortScore || a.name.localeCompare(b.name, "id");
    });
  }, [items, categories, getItemEvaluation]);

  const markers = useMemo<MapMarker[]>(
    () =>
      visible.map((item) => {
        const evaluation = getItemEvaluation(item);
        const band: ScoreBand = evaluation.band;
        const status =
          evaluation.isOpen && evaluation.score !== null
            ? `skor ${evaluation.score}, ${evaluation.label} pukul ${selectedHour ?? slotHour(item.bestByDay[dayIndex]?.localTime ?? "")}`
            : evaluation.timeText;

        const timeDetail = selectedHour
          ? `pukul ${selectedHour}`
          : item.bestByDay[dayIndex]
            ? `pukul ${slotHour(item.bestByDay[dayIndex]!.localTime)}`
            : "";
        const weatherParts = [
          timeDetail,
          evaluation.weatherDesc,
          evaluation.t !== null ? `${Math.round(evaluation.t)}°C` : "",
        ].filter(Boolean);

        return {
          id: item.slug,
          lat: item.lat,
          lon: item.lon,
          color: BAND_COLOR[band],
          glyph: item.category,
          shape: "pin",
          label: `${item.name}, ${CATEGORY_LABEL[item.category]}, ${status}`,
          title: item.name,
          subtitle: `${CATEGORY_LABEL[item.category]} · ${item.kabupaten}`,
          score: evaluation.isOpen ? evaluation.score : null,
          scoreLabel: evaluation.label,
          band: evaluation.band,
          badgeText: evaluation.isOpen ? undefined : evaluation.label,
          weatherText: evaluation.isOpen ? weatherParts.join(" · ") : evaluation.timeText,
        };
      }),
    [visible, getItemEvaluation, selectedHour, dayIndex],
  );

  const toggleCategory = (category: DestCategory) =>
    setCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );

  const select = (slug: string, fromMap = false) => {
    setSelectedSlug(slug);
    if (fromMap) {
      if (!isDesktop && sheet === "collapsed") setSheet("half");
      requestAnimationFrame(() =>
        listRef.current?.querySelector(`[data-slug="${slug}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      );
    }
  };

  // Seret pegangan: naik = lebih besar, turun = lebih kecil (ambang 40px).
  const dragStart = useRef<number | null>(null);
  const moveSheet = (direction: 1 | -1) =>
    setSheet((current) => SHEET_ORDER[Math.min(2, Math.max(0, SHEET_ORDER.indexOf(current) + direction))]);

  return (
    <div
      className="relative overflow-hidden md:grid md:grid-cols-[360px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]"
      style={{ height: "calc(100dvh - 57px)" }}
    >
      <aside
        data-sheet={sheet}
        aria-label="Daftar destinasi"
        className="absolute inset-x-0 bottom-0 z-20 flex h-[88px] flex-col rounded-t-xl bg-canvas shadow-[0_-2px_12px_rgba(20,20,19,0.12)] transition-[height] duration-200 data-[sheet=full]:h-[calc(100%-12px)] data-[sheet=half]:h-[55%] md:static md:h-full! md:min-h-0 md:rounded-none md:shadow-none md:border-r md:border-hairline"
      >
        {/* Pegangan bottom sheet (hanya ponsel) */}
        <button
          type="button"
          aria-expanded={sheet !== "collapsed"}
          aria-label={`Ubah ukuran daftar, sekarang ${sheet === "collapsed" ? "terlipat" : sheet === "half" ? "setengah" : "penuh"}`}
          onClick={() => setSheet((c) => SHEET_ORDER[(SHEET_ORDER.indexOf(c) + 1) % SHEET_ORDER.length])}
          onPointerDown={(e) => {
            dragStart.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (dragStart.current === null) return;
            const delta = e.clientY - dragStart.current;
            dragStart.current = null;
            if (Math.abs(delta) > 40) {
              moveSheet(delta < 0 ? 1 : -1);
              e.preventDefault();
            }
          }}
          className="flex min-h-11 w-full touch-none flex-col items-center justify-center gap-1 md:hidden"
        >
          <span className="h-1 w-9 rounded-pill bg-border-input" aria-hidden="true" />
          <span className="text-[13px] font-medium text-muted" aria-live="polite">
            {visible.length} destinasi
          </span>
        </button>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-2 md:pt-6">
          <div className="sr-only md:not-sr-only">
            <h1>Kapan waktu terbaik berkunjung?</h1>
            <p className="mt-2 text-sm text-muted">
              Skor kelayakan per slot 3 jam untuk 20 destinasi di DIY, dari prakiraan BMKG.
            </p>
          </div>

          {source?.isStale && (
            <StatusBanner kind="stale">
              Data belum diperbarui.{" "}
              {source.fetchedAt
                ? `Prakiraan terakhir diambil ${formatWibDateTime(source.fetchedAt)}.`
                : "Prakiraan belum pernah berhasil diambil."}
            </StatusBanner>
          )}

          <div role="tablist" aria-label="Pilih hari" className="flex gap-2">
            {days.map((day, index) => (
              <button
                key={day}
                role="tab"
                type="button"
                aria-selected={dayIndex === index}
                onClick={() => setDayIndex(index)}
                className={`min-h-11 flex-1 rounded-md border px-2 py-1 text-sm font-semibold leading-tight ${
                  dayIndex === index
                    ? "border-surface-dark bg-surface-dark text-on-dark"
                    : "border-border-input bg-canvas text-ink hover:bg-surface-soft"
                }`}
              >
                <span className="block">{relativeDayName(index)}</span>
                <span className="block text-[12px] font-normal opacity-90">{formatDayKey(day)}</span>
              </button>
            ))}
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-muted">
              Jam kunjungan ({relativeDayName(dayIndex).toLowerCase()})
            </legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pilih jam kunjungan">
              <button
                type="button"
                role="radio"
                aria-checked={selectedHour === null}
                onClick={() => setSelectedHour(null)}
                className={`inline-flex min-h-9 items-center rounded-pill border px-3 text-[13px] font-medium transition-colors ${
                  selectedHour === null
                    ? "border-surface-dark bg-surface-dark text-on-dark font-semibold"
                    : "border-border-input bg-canvas text-ink hover:bg-surface-soft"
                }`}
              >
                ⭐ Waktu Terbaik
              </button>
              {STANDARD_HOURS.map((hour) => {
                const checked = selectedHour === hour;
                return (
                  <button
                    key={hour}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setSelectedHour(hour)}
                    className={`inline-flex min-h-9 items-center rounded-pill border px-2.5 text-[13px] font-medium transition-colors ${
                      checked
                        ? "border-surface-dark bg-surface-dark text-on-dark font-semibold"
                        : "border-border-input bg-canvas text-ink hover:bg-surface-soft"
                    }`}
                  >
                    {hour}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-muted">Kategori (boleh lebih dari satu)</legend>
            <div className="flex flex-wrap gap-2">
              {DEST_CATEGORIES.map((category) => {
                const pressed = categories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => toggleCategory(category)}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-pill border px-3 text-sm font-medium ${
                      pressed
                        ? "border-surface-dark bg-surface-dark text-on-dark"
                        : "border-border-input bg-canvas text-ink hover:bg-surface-soft"
                    }`}
                  >
                    <CategoryIcon category={category} size={16} />
                    {CATEGORY_LABEL[category]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <p className="hidden text-sm text-muted md:block" aria-live="polite">
            {selectedHour
              ? `${visible.length} destinasi, diurutkan untuk ${relativeDayName(dayIndex).toLowerCase()} pukul ${selectedHour} WIB`
              : `${visible.length} destinasi, skor terbaik ${relativeDayName(dayIndex).toLowerCase()} lebih dulu`}
          </p>

          <ul ref={listRef} className="flex flex-col gap-3">
            {visible.map((item) => {
              const evaluation = getItemEvaluation(item);
              const selected = item.slug === selectedSlug;
              return (
                <li
                  key={item.slug}
                  data-slug={item.slug}
                  className={`rounded-lg bg-surface-card p-4 ${selected ? "outline-2 outline-surface-dark" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-sans text-[17px] font-semibold leading-snug tracking-normal">
                        <Link href={`/destinasi/${item.slug}`} className="text-ink">
                          {item.name}
                        </Link>
                      </h2>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {CATEGORY_LABEL[item.category]} · {item.kabupaten}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => select(item.slug)}
                      aria-label={`Tampilkan ${item.name} di peta`}
                      className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-body hover:bg-surface-card-strong"
                    >
                      <MiscIcon name="mapPin" size={20} />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {evaluation.isOpen && evaluation.score !== null ? (
                      <>
                        <ScoreChip score={evaluation.score} />
                        <span className="text-[13px] text-muted">
                          {evaluation.timeText}
                          {evaluation.weatherDesc ? ` · ${evaluation.weatherDesc}` : ""}
                          {evaluation.t !== null ? ` (${Math.round(evaluation.t)}°C)` : ""}
                        </span>
                      </>
                    ) : (
                      <>
                        <ScoreChip score={null} />
                        <span className="text-[13px] text-muted">{evaluation.timeText}</span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 border-t border-hairline pt-4">
            <AttributionBar />
          </div>
        </div>
      </aside>

      <MapView
        className="h-full w-full"
        styleUrl={mapStyleUrl}
        markers={markers}
        selectedId={selectedSlug}
        onSelect={(slug) => select(slug, true)}
        fitKey={categories.join(",")}
        getPadding={() =>
          isDesktop
            ? { top: 56, bottom: 56, left: 56, right: 56 }
            : // Sheet setengah-layar menutupi 55% bawah; sisakan ruang agar penanda selatan tetap terlihat.
              { top: 72, bottom: Math.round(window.innerHeight * 0.55) + 24, left: 40, right: 40 }
        }
        ariaLabel="Peta destinasi wisata DIY. Semua isi peta juga tersedia di daftar."
      />
    </div>
  );
}
