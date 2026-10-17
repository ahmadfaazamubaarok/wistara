"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AttributionBar } from "@/components/attribution-bar";
import { CategoryIcon, MiscIcon, WeatherIcon } from "@/components/icons";
import { MapView, type MapMarker } from "@/components/map/map-view";
import { MapLegend } from "@/components/map/map-legend";
import { ScoreChip } from "@/components/score-chip";
import { StatusBanner } from "@/components/ui";
import { CATEGORY_LABEL, DEST_CATEGORIES, FACILITY_LABEL, type DestCategory, type FacilityType } from "@/lib/categories";
import { FACILITY_COLOR } from "@/lib/icon-data";
import { formatDayKey, formatDistance, formatWibDateTime, relativeDayName, slotHour } from "@/lib/format";
import { bestOverlappingSlot } from "@/lib/forecast/slots";
import { getDestinationEnrichment } from "@/lib/destination-enrichment";
import { getGoogleMapsPlaceUrl } from "@/lib/google-maps";
import { WistaraAiPanel } from "./wistara-ai-panel";
import { BAND_COLOR, type ScoreBand } from "@/lib/score-band";

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

export type FacilityItem = {
  id: number;
  type: FacilityType;
  name: string | null;
  lat: number;
  lon: number;
  distanceM: number;
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

const DEFAULT_SIDEBAR_WIDTH = 440;
const MIN_SIDEBAR_WIDTH = 360;
const MAX_SIDEBAR_WIDTH = 720;

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
  const [searchQuery, setSearchQuery] = useState("");
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [nearbyFacilities, setNearbyFacilities] = useState<FacilityItem[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
  const facilityCacheRef = useRef<Record<string, FacilityItem[]>>({});

  // Muat fasilitas umum terdekat (toilet, tempat makan, tempat ibadah, parkir, ATM) saat destinasi dipilih
  useEffect(() => {
    if (!selectedSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNearbyFacilities([]);
      return;
    }

    if (facilityCacheRef.current[selectedSlug]) {
      setNearbyFacilities(facilityCacheRef.current[selectedSlug]);
      return;
    }

    let isMounted = true;
    setIsLoadingFacilities(true);

    fetch(
      `/api/v1/destinations/${encodeURIComponent(selectedSlug)}/facilities?radius=1000&type=toilet,parkir,makan,ibadah,atm`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        const list = (data?.facilities as FacilityItem[]) || [];
        facilityCacheRef.current[selectedSlug] = list;
        setNearbyFacilities(list);
      })
      .catch(() => {
        if (isMounted) setNearbyFacilities([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingFacilities(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSlug]);
  const [sheet, setSheet] = useState<Sheet>("half");
  const [sidebarTab, setSidebarTab] = useState<"explore" | "ai">("explore");

  const handleTabChange = (tab: "explore" | "ai") => {
    setSidebarTab(tab);
    try {
      sessionStorage.setItem("wistara-sidebar-tab", tab);
    } catch { }
  };

  // Pulihkan preferensi tab dari sessionStorage setelah mount
  useEffect(() => {
    try {
      const savedTab = sessionStorage.getItem("wistara-sidebar-tab");
      if (savedTab === "ai" || savedTab === "explore") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSidebarTab(savedTab);
      }
    } catch { }
  }, []);

  const isDesktop = useIsDesktop();
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const accordionRef = useRef<HTMLDivElement>(null);
  const [isListExpanded, setIsListExpanded] = useState(false);

  // Lebar panel samping untuk desktop (bawaan 440px, bisa ditarik-geser antara 360px - 720px)
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH);

  // Ambil preferensi lebar panel tersimpan dari localStorage setelah mount di client (mencegah hydration mismatch)
  // Membaca localStorage hanya bisa setelah mount agar HTML server dan klien sama; setState di sini disengaja.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wistara-sidebar-width");
      if (saved) {
        const parsed = Number(saved);
        if (parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSidebarWidth(parsed);
        }
      }
    } catch { }
  }, []);
  const isResizing = useRef(false);

  const startResizing = (e: React.PointerEvent<HTMLDivElement>) => {
    isResizing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizing = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    const maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, Math.round(window.innerWidth * 0.65));
    const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxAllowed, e.clientX));
    setSidebarWidth(newWidth);
  };

  const stopResizing = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    isResizing.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
      localStorage.setItem("wistara-sidebar-width", String(sidebarWidth));
    } catch { }
  };

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
    const q = searchQuery.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (categories.length && !categories.includes(item.category)) {
        return false;
      }
      if (q) {
        const nameMatch = item.name.toLowerCase().includes(q);
        const kabupatenMatch = item.kabupaten.toLowerCase().includes(q);
        const categoryMatch = CATEGORY_LABEL[item.category]?.toLowerCase().includes(q);
        const enrichment = getDestinationEnrichment(item.slug);
        const tagMatch = enrichment?.tags.some((t) => t.toLowerCase().includes(q));
        const highlightMatch = enrichment?.highlights.some((h) => h.toLowerCase().includes(q));
        if (!nameMatch && !kabupatenMatch && !categoryMatch && !tagMatch && !highlightMatch) {
          return false;
        }
      }
      return true;
    });

    // Skor tertinggi di hari/slot terpilih lebih dulu; tanpa slot buka di paling bawah.
    return [...filtered].sort((a, b) => {
      const evalA = getItemEvaluation(a);
      const evalB = getItemEvaluation(b);
      return evalB.sortScore - evalA.sortScore || a.name.localeCompare(b.name, "id");
    });
  }, [items, categories, searchQuery, getItemEvaluation]);

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

  const facilityMarkers = useMemo<MapMarker[]>(() => {
    if (!selectedSlug || nearbyFacilities.length === 0) return [];
    return nearbyFacilities.slice(0, 35).map((f) => ({
      id: `f-${f.id}`,
      lat: f.lat,
      lon: f.lon,
      label: `${FACILITY_LABEL[f.type]}: ${f.name ?? "tanpa nama"}, ${formatDistance(f.distanceM)}`,
      title: FACILITY_LABEL[f.type],
      subtitle: `${f.name ? f.name + " · " : ""}${formatDistance(f.distanceM)}`,
      color: FACILITY_COLOR[f.type] ?? "#1e2b45",
      glyph: f.type,
      shape: "circle" as const,
      size: 24,
    }));
  }, [selectedSlug, nearbyFacilities]);

  const allMarkers = useMemo(() => [...markers, ...facilityMarkers], [markers, facilityMarkers]);
  const selectedItem = useMemo(() => items.find((i) => i.slug === selectedSlug) ?? null, [items, selectedSlug]);

  const toggleCategory = (category: DestCategory) =>
    setCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );

  const topPicksToday = useMemo(() => {
    return items
      .map((item) => {
        const best = item.bestByDay[0];
        const bestSlot = best && item.slots ? item.slots.find((s) => s.localTime === best.localTime) : undefined;
        return {
          item,
          score: best?.score ?? -1,
          band: best?.band ?? ("closed" as ScoreBand),
          label: best?.label ?? "Tutup",
          timeText: best ? `pukul ${slotHour(best.localTime)}` : "Tutup",
          weatherDesc: bestSlot?.weatherDesc ?? null,
          t: bestSlot?.t ?? null,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "id"))
      .slice(0, 3);
  }, [items]);

  const weatherSummaryToday = useMemo(() => {
    const total = items.length;
    const highlyRecommended = items.filter((i) => (i.bestByDay[0]?.score ?? 0) >= 80).length;
    const recommended = items.filter((i) => {
      const s = i.bestByDay[0]?.score ?? 0;
      return s >= 60 && s < 80;
    }).length;

    const weatherFreq: Record<string, number> = {};
    for (const item of items) {
      const best = item.bestByDay[0];
      if (best && item.slots) {
        const slot = item.slots.find((s) => s.localTime === best.localTime);
        if (slot?.weatherDesc) {
          weatherFreq[slot.weatherDesc] = (weatherFreq[slot.weatherDesc] || 0) + 1;
        }
      }
    }
    const dominantWeather =
      Object.entries(weatherFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "Cerah Berawan";

    return {
      total,
      highlyRecommended,
      recommended,
      dominantWeather,
    };
  }, [items]);

  const applyQuickFilter = (type: "alam" | "budaya" | "hujan" | "sunset") => {
    setIsListExpanded(true);
    if (type === "alam") {
      setCategories(["alam", "pantai"]);
      setSearchQuery("");
      setSelectedHour(null);
    } else if (type === "budaya") {
      setCategories(["budaya"]);
      setSearchQuery("");
      setSelectedHour(null);
    } else if (type === "hujan") {
      setCategories(["budaya", "museum"]);
      setSearchQuery("");
      setSelectedHour(null);
    } else if (type === "sunset") {
      setCategories([]);
      setSearchQuery("");
      setSelectedHour("18.00");
    }
    setTimeout(() => {
      accordionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const select = (slug: string, fromMap = false) => {
    if (slug === selectedSlug) {
      // Klik penanda yang sama di peta -> tutup fasilitas
      setSelectedSlug(null);
      return;
    }
    setSelectedSlug(slug);
    if (fromMap) {
      setIsListExpanded(true);
      if (!isDesktop && sheet === "collapsed") setSheet("half");
      requestAnimationFrame(() =>
        setTimeout(() => {
          listRef.current?.querySelector(`[data-slug="${slug}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 150),
      );
    }
  };

  // Seret pegangan: naik = lebih besar, turun = lebih kecil (ambang 40px).
  const dragStart = useRef<number | null>(null);
  const moveSheet = (direction: 1 | -1) =>
    setSheet((current) => SHEET_ORDER[Math.min(2, Math.max(0, SHEET_ORDER.indexOf(current) + direction))]);

  return (
    <div
      className="relative overflow-hidden md:flex md:flex-row"
      style={{ height: "calc(100dvh - 57px)" }}
    >
      <aside
        data-sheet={sheet}
        aria-label="Daftar destinasi"
        style={{ width: isDesktop ? `${sidebarWidth}px` : undefined }}
        className="absolute inset-x-0 bottom-0 z-20 flex h-[88px] flex-col rounded-t-xl bg-canvas shadow-[0_-2px_12px_rgba(20,20,19,0.12)] transition-[height] duration-200 data-[sheet=full]:h-[calc(100%-12px)] data-[sheet=half]:h-[55%] md:static md:h-full! md:min-h-0 md:shrink-0 md:rounded-none md:shadow-none md:border-r md:border-hairline"
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
            {searchQuery ? `${visible.length} hasil pencarian` : `${visible.length} destinasi`}
          </span>
        </button>

        {/* Tab Switcher Puncak Panel Kiri (Jelajah Destinasi vs Tanya Wistara AI) */}
        <div
          className="flex shrink-0 border-b border-hairline bg-surface-card/70 p-1.5 gap-1.5"
          role="tablist"
          aria-label="Mode tampilan panel samping"
        >
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === "explore"}
            onClick={() => handleTabChange("explore")}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold transition-all ${sidebarTab === "explore"
                ? "border border-border-input bg-canvas text-ink shadow-xs"
                : "text-muted hover:bg-surface-soft hover:text-ink"
              }`}
          >
            <MiscIcon name="list" size={15} />
            <span>Jelajah Destinasi</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === "ai"}
            onClick={() => {
              handleTabChange("ai");
              if (!isDesktop && sheet === "collapsed") setSheet("half");
            }}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold transition-all ${sidebarTab === "ai"
                ? "border border-primary/30 bg-primary text-white shadow-xs"
                : "text-muted hover:bg-surface-soft hover:text-primary"
              }`}
          >
            <svg
              className={`h-4 w-4 ${sidebarTab === "ai" ? "text-white" : "text-primary"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              <path d="M20 3v4" />
              <path d="M22 5h-4" />
            </svg>
            <span>Tanya Wistara AI</span>
          </button>
        </div>

        <div className={`h-full min-h-0 flex-1 flex-col ${sidebarTab === "ai" ? "flex" : "hidden"}`}>
          <WistaraAiPanel
            onSelectDestination={(slug) => select(slug, true)}
            onClose={() => handleTabChange("explore")}
          />
        </div>

        <div className={`min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-2 md:pt-6 ${sidebarTab === "explore" ? "flex" : "hidden"}`}>
            <div className="sr-only md:not-sr-only">
              <h1 className="font-serif text-xl font-bold tracking-tight text-ink md:text-2xl">
                Kapan waktu terbaik berkunjung?
              </h1>
              <p className="mt-1 text-xs text-muted md:text-sm">
                Skor kelayakan & rekomendasi waktu dari prakiraan cuaca BMKG di DIY.
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

            {/* 1. Ringkasan Cuaca & Kondisi Wisata Hari Ini (Weather Pulse) */}
            <div className="rounded-xl border border-hairline/80 bg-surface-card p-3.5 shadow-xs">
              <div className="flex items-center justify-between border-b border-hairline/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <WeatherIcon description={weatherSummaryToday.dominantWeather} size={18} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">Kondisi Wisata Hari Ini</p>
                    <p className="text-[11px] text-muted">{formatDayKey(days[0] ?? "")}</p>
                  </div>
                </div>
                <span className="rounded-full bg-surface-card-strong px-2.5 py-0.5 text-[11px] font-medium text-body">
                  {weatherSummaryToday.dominantWeather}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-canvas/70 p-2 border border-hairline/50">
                  <p className="text-[11px] text-muted">Sangat Disarankan</p>
                  <p className="text-base font-bold text-score-good-text">
                    {weatherSummaryToday.highlyRecommended}{" "}
                    <span className="text-xs font-normal text-muted">/ {weatherSummaryToday.total}</span>
                  </p>
                  <p className="text-[10px] text-muted">Skor kelayakan ≥ 80</p>
                </div>
                <div className="rounded-lg bg-canvas/70 p-2 border border-hairline/50">
                  <p className="text-[11px] text-muted">Waktu Kunjungan Ideal</p>
                  <p className="text-base font-bold text-ink">08.00–15.00</p>
                  <p className="text-[10px] text-muted">Rata-rata slot terbaik</p>
                </div>
              </div>
            </div>

            {/* 2. Top Rekomendasi Teratas Hari Ini */}
            {topPicksToday.length > 0 && (
              <section aria-label="Rekomendasi terbaik hari ini" className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted">
                    ⭐ Rekomendasi Terbaik Hari Ini
                  </h2>
                  <span className="text-[11px] font-medium text-muted">Skor tertinggi</span>
                </div>

                <div className="flex flex-col gap-2">
                  {topPicksToday.map(({ item, score, timeText, weatherDesc, t }) => {
                    const selected = item.slug === selectedSlug;
                    const mapsUrl = getGoogleMapsPlaceUrl(item.name, item.kabupaten);
                    return (
                      <div
                        key={`top-${item.slug}`}
                        className={`group rounded-lg border bg-surface-card p-3 transition-all ${
                          selected
                            ? "border-surface-dark outline-2 outline-surface-dark"
                            : "border-hairline/80 hover:border-border-input/70 hover:bg-surface-card-strong"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-primary">
                                <CategoryIcon category={item.category} size={13} />
                              </span>
                              <span className="text-[11px] font-medium text-muted truncate">
                                {CATEGORY_LABEL[item.category]} · {item.kabupaten}
                              </span>
                            </div>
                            <h3 className="mt-0.5 truncate font-sans text-sm font-semibold text-ink">
                              <Link
                                href={`/destinasi/${item.slug}`}
                                className="hover:text-primary transition-colors"
                              >
                                {item.name}
                              </Link>
                            </h3>
                          </div>

                          <div className="flex items-center gap-1">
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Buka ${item.name} di Google Maps`}
                              title="Buka di Google Maps"
                              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-ink transition-colors"
                            >
                              <MiscIcon name="externalLink" size={13} />
                            </a>
                            <button
                              type="button"
                              onClick={() => select(item.slug)}
                              aria-label={`Tampilkan ${item.name} di peta`}
                              title="Tampilkan di peta"
                              className={`inline-flex size-7 shrink-0 items-center justify-center rounded-pill transition-colors ${
                                selected
                                  ? "bg-surface-dark text-on-dark"
                                  : "text-muted hover:bg-canvas hover:text-ink"
                              }`}
                            >
                              <MiscIcon name="mapPin" size={15} />
                            </button>
                          </div>
                        </div>

                            <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-hairline/60 pt-1.5 text-xs">
                              <div className="flex items-center gap-1.5">
                                <ScoreChip score={score} size="sm" />
                                <span className="text-[11px] font-medium text-muted">{timeText}</span>
                              </div>
                              {weatherDesc && (
                                <span className="text-[11px] text-muted truncate">
                                  {weatherDesc}
                                  {t !== null ? ` · ${Math.round(t)}°C` : ""}
                                </span>
                              )}
                            </div>

                        {selected && (
                          <div className="mt-2 flex items-center justify-between border-t border-hairline/60 pt-2 text-xs text-muted">
                            <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                              {isLoadingFacilities
                                ? "Memuat fasilitas sekitar..."
                                : `${nearbyFacilities.length} fasilitas terdekat aktif di peta`}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSlug(null);
                              }}
                              className="text-muted hover:text-ink underline underline-offset-2"
                            >
                              Tutup
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 3. Pintasan Situasional ("Mau ke mana hari ini?") */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted">
                  Eksplorasi Berdasarkan Minat
                </h2>
                <span className="text-[11px] text-muted">Filter cepat</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyQuickFilter("alam")}
                  className="flex items-center gap-2 rounded-lg border border-hairline/80 bg-surface-card p-2.5 text-left text-xs font-semibold text-ink transition-colors hover:border-border-input hover:bg-surface-card-strong"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-soft text-primary">
                    <CategoryIcon category="alam" size={15} />
                  </span>
                  <div>
                    <p className="leading-tight">Wisata Alam & Pantai</p>
                    <p className="text-[10px] font-normal text-muted">Outdoor & panorama</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyQuickFilter("budaya")}
                  className="flex items-center gap-2 rounded-lg border border-hairline/80 bg-surface-card p-2.5 text-left text-xs font-semibold text-ink transition-colors hover:border-border-input hover:bg-surface-card-strong"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-soft text-primary">
                    <CategoryIcon category="budaya" size={15} />
                  </span>
                  <div>
                    <p className="leading-tight">Candi & Budaya</p>
                    <p className="text-[10px] font-normal text-muted">Sejarah & budaya</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyQuickFilter("hujan")}
                  className="flex items-center gap-2 rounded-lg border border-hairline/80 bg-surface-card p-2.5 text-left text-xs font-semibold text-ink transition-colors hover:border-border-input hover:bg-surface-card-strong"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-soft text-primary">
                    <CategoryIcon category="museum" size={15} />
                  </span>
                  <div>
                    <p className="leading-tight">Ramah Saat Hujan</p>
                    <p className="text-[10px] font-normal text-muted">Museum & indoor</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyQuickFilter("sunset")}
                  className="flex items-center gap-2 rounded-lg border border-hairline/80 bg-surface-card p-2.5 text-left text-xs font-semibold text-ink transition-colors hover:border-border-input hover:bg-surface-card-strong"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-soft text-primary">
                    <MiscIcon name="clock" size={15} />
                  </span>
                  <div>
                    <p className="leading-tight">Waktu Sunset</p>
                    <p className="text-[10px] font-normal text-muted">Slot sore 18.00 WIB</p>
                  </div>
                </button>
              </div>
            </div>

            {/* 4. Banner Wistara AI */}
            <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 p-3 dark:bg-primary/10">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                    <path d="M20 3v4" />
                    <path d="M22 5h-4" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs font-semibold text-ink">Butuh Rekomendasi Khusus?</p>
                  <p className="text-[11px] text-muted">Konsultasikan rencanamu dengan AI</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleTabChange("ai");
                  if (!isDesktop && sheet === "collapsed") setSheet("half");
                }}
                className="inline-flex min-h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-white shadow-xs hover:bg-primary-active transition-colors"
              >
                Tanya AI
              </button>
            </div>

            {/* 5. Accordion Pencarian & Semua Destinasi */}
            <div ref={accordionRef} className="mt-1 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsListExpanded((prev) => {
                    const next = !prev;
                    if (next) {
                      setTimeout(() => searchInputRef.current?.focus(), 150);
                    }
                    return next;
                  });
                }}
                aria-expanded={isListExpanded}
                aria-controls="accordion-destination-list"
                className={`group flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all duration-200 ${
                  isListExpanded
                    ? "border-border-input bg-surface-card-strong shadow-xs"
                    : "border-border-input/70 bg-surface-card hover:border-border-input hover:bg-surface-card-strong shadow-xs"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isListExpanded
                        ? "bg-surface-dark text-on-dark"
                        : "bg-canvas text-muted border border-border-input/50"
                    }`}
                  >
                    <MiscIcon name="search" size={17} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {isListExpanded ? "Daftar & Filter Lengkap" : "Cari & Lihat Semua Destinasi"}
                      </span>
                      <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-bold text-muted border border-hairline/60">
                        {visible.length}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted">
                      {isListExpanded
                        ? "Klik untuk melipat panel daftar"
                        : "Buka pencarian, filter jam & 20 destinasi DIY"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pl-2 text-muted">
                  <span className="text-xs font-semibold hidden sm:inline">
                    {isListExpanded ? "Tutup" : "Buka"}
                  </span>
                  <span
                    className={`inline-flex transition-transform duration-300 ${
                      isListExpanded ? "rotate-180" : ""
                    }`}
                  >
                    <MiscIcon name="chevronDown" size={18} />
                  </span>
                </div>
              </button>

              {/* Konten Accordion yang Dapat Mengembang/Melipat dengan Animasi Halus */}
              <div
                id="accordion-destination-list"
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                  isListExpanded
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0 pointer-events-none"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="flex flex-col gap-4 pt-2">
                    {/* Input Pencarian Utama yang Dipindah ke Dalam Accordion */}
                    <div className="relative w-full">
                      <label htmlFor="cari-destinasi" className="sr-only">
                        Cari destinasi wisata
                      </label>
                      <div className="relative flex items-center">
                        <span className="pointer-events-none absolute left-3 text-muted" aria-hidden="true">
                          <MiscIcon name="search" size={18} />
                        </span>
                        <input
                          ref={searchInputRef}
                          id="cari-destinasi"
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari wisata, daerah, atau minat (mis. sunset, candi, pantai)…"
                          className="min-h-11 w-full rounded-md border border-border-input bg-canvas pl-9 pr-9 text-base text-ink placeholder:text-muted focus:border-focus"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            aria-label="Hapus kata kunci pencarian"
                            className="absolute right-2 inline-flex size-8 items-center justify-center rounded-pill text-muted hover:bg-surface-soft hover:text-ink"
                          >
                            <MiscIcon name="x" size={16} />
                          </button>
                        )}
                      </div>
                    </div>

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
                      <legend className="mb-2 text-sm font-medium text-muted">
                        Kategori (boleh lebih dari satu)
                      </legend>
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
                      {searchQuery
                        ? `${visible.length} destinasi ditemukan untuk "${searchQuery}"`
                        : selectedHour
                          ? `${visible.length} destinasi, diurutkan untuk ${relativeDayName(dayIndex).toLowerCase()} pukul ${selectedHour} WIB`
                          : `${visible.length} destinasi, skor terbaik ${relativeDayName(dayIndex).toLowerCase()} lebih dulu`}
                    </p>

                    {visible.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-lg bg-surface-card p-6 text-center">
                        <p className="font-semibold text-ink">Tidak ada destinasi ditemukan</p>
                        <p className="mt-1 text-sm text-muted">
                          {searchQuery
                            ? `Tidak ada wisata yang cocok dengan "${searchQuery}".`
                            : "Tidak ada wisata yang sesuai dengan filter kategori."}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery("");
                            setCategories([]);
                            setSelectedHour(null);
                          }}
                          className="mt-3 inline-flex min-h-9 items-center rounded-md border border-border-input bg-canvas px-3 text-sm font-semibold text-ink hover:bg-surface-soft"
                        >
                          Reset pencarian & filter
                        </button>
                      </div>
                    ) : (
                      <ul ref={listRef} className="flex flex-col gap-3">
                        {visible.map((item) => {
                          const evaluation = getItemEvaluation(item);
                          const selected = item.slug === selectedSlug;
                          const mapsUrl = getGoogleMapsPlaceUrl(item.name, item.kabupaten);
                          return (
                            <li
                              key={item.slug}
                              data-slug={item.slug}
                              className={`rounded-lg bg-surface-card p-4 transition-all ${
                                selected ? "outline-2 outline-surface-dark" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h3 className="font-sans text-[17px] font-semibold leading-snug tracking-normal">
                                    <Link
                                      href={`/destinasi/${item.slug}`}
                                      className="text-ink hover:text-primary transition-colors"
                                    >
                                      {item.name}
                                    </Link>
                                  </h3>
                                  <p className="mt-0.5 text-[13px] text-muted">
                                    {CATEGORY_LABEL[item.category]} · {item.kabupaten}
                                  </p>
                                  {(() => {
                                    const enrichment = getDestinationEnrichment(item.slug);
                                    if (!enrichment || !enrichment.tags.length) return null;
                                    return (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {enrichment.tags.slice(0, 3).map((tag) => (
                                          <span
                                            key={tag}
                                            className="rounded bg-surface-soft px-1.5 py-0.5 text-[11px] font-medium text-muted"
                                          >
                                            #{tag}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>

                                <div className="flex items-center gap-1 shrink-0 -mr-2 -mt-1">
                                  <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Buka di Google Maps"
                                    aria-label={`Buka ${item.name} di Google Maps`}
                                    className="inline-flex size-11 items-center justify-center rounded-pill text-muted hover:bg-surface-card-strong hover:text-ink transition-colors"
                                  >
                                    <MiscIcon name="externalLink" size={17} />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => select(item.slug)}
                                    aria-label={`Tampilkan ${item.name} di peta`}
                                    title="Tampilkan di peta"
                                    className="inline-flex size-11 items-center justify-center rounded-pill text-body hover:bg-surface-card-strong transition-colors"
                                  >
                                    <MiscIcon name="mapPin" size={20} />
                                  </button>
                                </div>
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
                              {selected && (
                                <div className="mt-2.5 flex items-center justify-between border-t border-hairline/60 pt-2 text-xs text-muted">
                                  <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    {isLoadingFacilities
                                      ? "Memuat fasilitas sekitar..."
                                      : `${nearbyFacilities.length} fasilitas terdekat aktif di peta`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSlug(null);
                                    }}
                                    className="text-muted hover:text-ink underline underline-offset-2"
                                  >
                                    Sembunyikan
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Tombol Tutup Daftar di Bagian Bawah Accordion */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsListExpanded(false);
                        accordionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="mt-1 flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border-input/70 bg-surface-card px-3 text-xs font-semibold text-muted hover:bg-surface-card-strong hover:text-ink transition-colors"
                    >
                      <MiscIcon name="chevronUp" size={16} />
                      <span>Tutup Daftar & Kembali ke Ringkasan</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 border-t border-hairline pt-4">
              <AttributionBar />
            </div>
          </div>
      </aside>

      {/* Pengatur lebar panel desktop (tarik-geser / draggable splitter) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Tarik untuk mengubah lebar panel daftar destinasi"
        aria-valuenow={sidebarWidth}
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        tabIndex={0}
        onPointerDown={startResizing}
        onPointerMove={onResizing}
        onPointerUp={stopResizing}
        onPointerCancel={stopResizing}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            setSidebarWidth((w) => {
              const next = Math.max(MIN_SIDEBAR_WIDTH, w - 24);
              try { localStorage.setItem("wistara-sidebar-width", String(next)); } catch { }
              return next;
            });
          } else if (e.key === "ArrowRight") {
            setSidebarWidth((w) => {
              const next = Math.min(MAX_SIDEBAR_WIDTH, w + 24);
              try { localStorage.setItem("wistara-sidebar-width", String(next)); } catch { }
              return next;
            });
          }
        }}
        className="group relative z-30 hidden w-2 shrink-0 cursor-col-resize select-none touch-none items-center justify-center bg-canvas transition-colors hover:bg-surface-soft active:bg-surface-card-strong md:flex"
      >
        <span
          className="h-10 w-1 rounded-pill bg-border-input/50 transition-colors group-hover:bg-primary group-active:bg-primary"
          aria-hidden="true"
        />
      </div>

      <div className="relative h-full flex-1 min-w-0">
        <MapView
          className="home-map h-full w-full"
          styleUrl={mapStyleUrl}
          markers={allMarkers}
          selectedId={selectedSlug}
          onSelect={(slug) => {
            if (slug.startsWith("f-")) return;
            select(slug, true);
          }}
          fitKey={`${categories.join(",")}-${searchQuery}`}
          getPadding={() =>
            isDesktop
              ? { top: 56, bottom: 56, left: 56, right: 56 }
              : // Sheet setengah-layar menutupi 55% bawah; sisakan ruang agar penanda selatan tetap terlihat.
              { top: 72, bottom: Math.round(window.innerHeight * 0.55) + 24, left: 40, right: 40 }
          }
          ariaLabel="Peta destinasi wisata DIY. Semua isi peta juga tersedia di daftar."
        >
          <MapLegend />

          {/* Chip info fasilitas terdekat saat destinasi dipilih */}
          {selectedItem && (
            <div className="pointer-events-auto absolute left-3 top-3 z-10 flex max-w-[calc(100%-140px)] items-center gap-2 rounded-full border border-hairline/90 bg-canvas/95 px-3 py-1.5 shadow-md shadow-ink/5 backdrop-blur-md md:left-4 md:top-4 dark:bg-surface-card/95 dark:shadow-black/25">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <p className="truncate text-xs font-medium text-ink">
                Fasilitas sekitar <strong className="font-semibold">{selectedItem.name}</strong>{" "}
                <span className="text-muted">
                  {isLoadingFacilities
                    ? "(memuat...)"
                    : nearbyFacilities.length > 0
                    ? `(${nearbyFacilities.length} titik)`
                    : "(tidak ada dalam 1 km)"}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setSelectedSlug(null)}
                aria-label="Tutup penanda fasilitas"
                className="ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
              >
                <MiscIcon name="x" size={12} />
              </button>
            </div>
          )}
        </MapView>
      </div>
    </div>
  );
}
