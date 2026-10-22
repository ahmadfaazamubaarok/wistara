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
import { SeaBadge } from "@/components/sea-badge";
import { type SeaStatus } from "@/lib/marine/sea-status";

export type HomeSlotItem = {
  validAt: string;
  localTime: string;
  isOpen: boolean;
  score: number | null;
  label: string;
  band: ScoreBand;
  weatherDesc: string | null;
  t: number | null;
  seaStatus?: SeaStatus | null;
  waveHeightMax?: number | null;
  waveCat?: string | null;
};

export type HomeItem = {
  slug: string;
  name: string;
  category: DestCategory;
  lat: number;
  lon: number;
  kabupaten: string;
  marineAreaCode?: string | null;
  /** Selaras dengan `days`; null = tidak ada slot buka pada hari itu. */
  bestByDay: ({
    localTime: string;
    score: number;
    label: string;
    band: ScoreBand;
    seaStatus?: SeaStatus | null;
    waveHeightMax?: number | null;
    waveCat?: string | null;
  } | null)[];
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
          seaStatus: best?.seaStatus ?? null,
          waveHeightMax: best?.waveHeightMax ?? null,
          waveCat: best?.waveCat ?? null,
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
          seaStatus: null,
          waveHeightMax: null,
          waveCat: null,
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
        seaStatus: slot.seaStatus ?? null,
        waveHeightMax: slot.waveHeightMax ?? null,
        waveCat: slot.waveCat ?? null,
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
          seaStatus: item.category === "pantai" ? evaluation.seaStatus : null,
          waveHeightMax: item.category === "pantai" ? evaluation.waveHeightMax : null,
          waveCat: item.category === "pantai" ? evaluation.waveCat : null,
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
    if (type === "alam") {
      setCategories((prev) => (prev.length === 2 && prev.includes("alam") && prev.includes("pantai") ? [] : ["alam", "pantai"]));
      setSearchQuery("");
      setSelectedHour(null);
    } else if (type === "budaya") {
      setCategories((prev) => (prev.length === 1 && prev.includes("budaya") ? [] : ["budaya"]));
      setSearchQuery("");
      setSelectedHour(null);
    } else if (type === "hujan") {
      setCategories((prev) => (prev.length === 2 && prev.includes("budaya") && prev.includes("museum") ? [] : ["budaya", "museum"]));
      setSearchQuery("");
      setSelectedHour(null);
    } else if (type === "sunset") {
      setCategories([]);
      setSearchQuery("");
      setSelectedHour((prev) => (prev === "18.00" ? null : "18.00"));
    }
  };

  const select = (slug: string, fromMap = false) => {
    if (slug === selectedSlug) {
      // Klik penanda yang sama di peta -> tutup fasilitas
      setSelectedSlug(null);
      return;
    }
    setSelectedSlug(slug);
    if (fromMap) {
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
                : "text-muted hover:bg-surface-soft hover:text-link"
              }`}
          >
            <svg
              className={`h-4 w-4 ${sidebarTab === "ai" ? "text-white" : "text-link"}`}
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

        <div className={`min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-3 md:pt-4 ${sidebarTab === "explore" ? "flex" : "hidden"}`}>
          <div className="flex flex-col gap-4">
            {/* 1. Header Ringkas & Status Cuaca */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-serif text-lg font-bold tracking-tight text-ink md:text-xl">
                  Eksplorasi Destinasi DIY
                </h1>
                <p className="mt-0.5 text-xs text-muted">
                  Waktu terbaik wisata berbasis prakiraan BMKG
                </p>
              </div>

              <div
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline/80 bg-surface-card px-2.5 py-1 text-xs text-body shadow-2xs"
                title="Kondisi cuaca umum di DIY hari ini"
              >
                <span className="text-link">
                  <WeatherIcon description={weatherSummaryToday.dominantWeather} size={15} />
                </span>
                <span className="font-semibold text-ink">{weatherSummaryToday.dominantWeather}</span>
              </div>
            </div>

            {source?.isStale && (
              <StatusBanner kind="stale">
                Data belum diperbarui.{" "}
                {source.fetchedAt
                  ? `Prakiraan terakhir diambil ${formatWibDateTime(source.fetchedAt)}.`
                  : "Prakiraan belum pernah berhasil diambil."}
              </StatusBanner>
            )}

            {/* 2. Search Input Utama (Selalu Terbuka & Mudah Dijangkau) */}
            <div className="relative w-full">
              <label htmlFor="cari-destinasi" className="sr-only">
                Cari destinasi wisata
              </label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-muted" aria-hidden="true">
                  <MiscIcon name="search" size={17} />
                </span>
                <input
                  ref={searchInputRef}
                  id="cari-destinasi"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, daerah, atau tag (mis. pantai, candi, sunset)…"
                  className="min-h-11 w-full rounded-lg border border-border-input bg-canvas pl-9 pr-9 text-sm text-ink placeholder:text-muted focus:border-focus focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Hapus kata kunci pencarian"
                    className="absolute right-2 inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-soft hover:text-ink transition-colors"
                  >
                    <MiscIcon name="x" size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* 3. Filter Hub: Tab Hari, Kategori, & Jam */}
            <div className="flex flex-col gap-2.5">
              {/* Tab Pemilihan Hari */}
              <div role="tablist" aria-label="Pilih hari kunjungan" className="flex gap-1.5 rounded-lg border border-hairline/80 bg-surface-soft p-1">
                {days.map((day, index) => (
                  <button
                    key={day}
                    role="tab"
                    type="button"
                    aria-selected={dayIndex === index}
                    onClick={() => setDayIndex(index)}
                    className={`flex-1 rounded-md py-1.5 px-2 text-center text-xs font-semibold transition-all ${
                      dayIndex === index
                        ? "bg-canvas text-ink shadow-xs border border-hairline/80 font-bold"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    <span className="block leading-tight">{relativeDayName(index)}</span>
                    <span className="block text-[10px] font-normal opacity-75">{formatDayKey(day)}</span>
                  </button>
                ))}
              </div>

              {/* Kategori Chips (Pill Filter) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategories([])}
                  className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-medium transition-colors ${
                    categories.length === 0
                      ? "bg-surface-dark text-on-dark font-semibold shadow-2xs"
                      : "border border-border-input/70 bg-canvas text-muted hover:border-border-input hover:text-ink"
                  }`}
                >
                  Semua
                </button>
                {DEST_CATEGORIES.map((category) => {
                  const pressed = categories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => toggleCategory(category)}
                      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors ${
                        pressed
                          ? "bg-surface-dark text-on-dark font-semibold shadow-2xs"
                          : "border border-border-input/70 bg-canvas text-muted hover:border-border-input hover:text-ink"
                      }`}
                    >
                      <CategoryIcon category={category} size={13} />
                      <span>{CATEGORY_LABEL[category]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Filter Jam Acuan Kunjungan */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-xs no-scrollbar">
                <span className="text-[11px] font-medium text-muted shrink-0">Waktu:</span>
                <button
                  type="button"
                  onClick={() => setSelectedHour(null)}
                  className={`inline-flex min-h-7 shrink-0 items-center rounded-md px-2 text-[11px] font-medium transition-colors ${
                    selectedHour === null
                      ? "bg-primary text-white font-semibold shadow-2xs"
                      : "border border-border-input/60 bg-canvas text-muted hover:text-ink"
                  }`}
                >
                  ⭐ Terbaik
                </button>
                {STANDARD_HOURS.map((hour) => {
                  const checked = selectedHour === hour;
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => setSelectedHour(checked ? null : hour)}
                      className={`inline-flex min-h-7 shrink-0 items-center rounded-md px-2 text-[11px] font-medium transition-colors ${
                        checked
                          ? "bg-surface-dark text-on-dark font-semibold shadow-2xs"
                          : "border border-border-input/60 bg-canvas text-muted hover:text-ink"
                      }`}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Inspirasi Cepat (Hanya tampil bila pencarian kosong dan filter kategori belum dipilih) */}
            {!searchQuery && categories.length === 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Inspirasi Cepat
                </span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => applyQuickFilter("alam")}
                    className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-card p-2 text-left text-xs font-medium text-ink transition-all hover:bg-surface-soft hover:border-border-input"
                  >
                    <span>🌲</span>
                    <span className="truncate">Alam & Pantai</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickFilter("budaya")}
                    className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-card p-2 text-left text-xs font-medium text-ink transition-all hover:bg-surface-soft hover:border-border-input"
                  >
                    <span>🏛️</span>
                    <span className="truncate">Candi & Budaya</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickFilter("hujan")}
                    className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-card p-2 text-left text-xs font-medium text-ink transition-all hover:bg-surface-soft hover:border-border-input"
                  >
                    <span>☔</span>
                    <span className="truncate">Ramah Hujan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickFilter("sunset")}
                    className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-card p-2 text-left text-xs font-medium text-ink transition-all hover:bg-surface-soft hover:border-border-input"
                  >
                    <span>🌅</span>
                    <span className="truncate">Waktu Sunset</span>
                  </button>
                </div>
              </div>
            )}

            {/* 5. Daftar Utama Seluruh Destinasi */}
            <section aria-label="Daftar destinasi wisata" className="flex flex-col gap-3 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink" aria-live="polite">
                  {searchQuery
                    ? `${visible.length} hasil ditemukan`
                    : selectedHour
                    ? `${visible.length} destinasi (pukul ${selectedHour})`
                    : `${visible.length} destinasi tersedia`}
                </span>
                {(searchQuery || categories.length > 0 || selectedHour !== null) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCategories([]);
                      setSelectedHour(null);
                    }}
                    className="text-xs font-semibold text-link hover:underline"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-hairline bg-surface-card p-8 text-center">
                  <p className="font-semibold text-ink">Tidak ada destinasi yang cocok</p>
                  <p className="mt-1 text-xs text-muted max-w-[280px]">
                    {searchQuery
                      ? `Tidak ada tempat wisata yang cocok dengan "${searchQuery}".`
                      : "Tidak ada destinasi yang memenuhi kriteria filter."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCategories([]);
                      setSelectedHour(null);
                    }}
                    className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-border-input bg-canvas px-4 text-xs font-semibold text-ink hover:bg-surface-soft transition-colors"
                  >
                    Reset Pencarian & Filter
                  </button>
                </div>
              ) : (
                <ul ref={listRef} className="flex flex-col gap-2.5">
                  {visible.map((item) => {
                    const evaluation = getItemEvaluation(item);
                    const selected = item.slug === selectedSlug;
                    const mapsUrl = getGoogleMapsPlaceUrl(item.name, item.kabupaten);
                    return (
                      <li
                        key={item.slug}
                        data-slug={item.slug}
                        onClick={() => select(item.slug)}
                        className={`group cursor-pointer rounded-xl border p-3.5 transition-all ${
                          selected
                            ? "border-surface-dark bg-surface-card outline-2 outline-surface-dark shadow-sm"
                            : "border-hairline/80 bg-surface-card hover:border-border-input hover:bg-surface-card-strong shadow-2xs"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted">
                              <span className="text-link">
                                <CategoryIcon category={item.category} size={13} />
                              </span>
                              <span className="truncate">
                                {CATEGORY_LABEL[item.category]} · {item.kabupaten}
                              </span>
                            </div>

                            <h3 className="mt-1 font-sans text-base font-semibold leading-snug text-ink group-hover:text-link transition-colors">
                              <Link
                                href={`/destinasi/${item.slug}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:underline"
                              >
                                {item.name}
                              </Link>
                            </h3>

                            {(() => {
                              const enrichment = getDestinationEnrichment(item.slug);
                              if (!enrichment || !enrichment.tags.length) return null;
                              return (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {enrichment.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium text-muted"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 -mr-1">
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Buka di Google Maps"
                              aria-label={`Buka ${item.name} di Google Maps`}
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-ink transition-colors"
                            >
                              <MiscIcon name="externalLink" size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                select(item.slug);
                              }}
                              aria-label={`Tampilkan ${item.name} di peta`}
                              title="Tampilkan di peta"
                              className={`inline-flex size-8 items-center justify-center rounded-pill transition-colors ${
                                selected
                                  ? "bg-surface-dark text-on-dark"
                                  : "text-muted hover:bg-surface-soft hover:text-ink"
                              }`}
                            >
                              <MiscIcon name="mapPin" size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-hairline/60 pt-2 text-xs">
                          {evaluation.isOpen && evaluation.score !== null ? (
                            <>
                              <ScoreChip score={evaluation.score} size="sm" />
                              {item.category === "pantai" && evaluation.seaStatus && (
                                <SeaBadge
                                  status={evaluation.seaStatus}
                                  waveHeight={evaluation.waveHeightMax}
                                  waveCat={evaluation.waveCat}
                                  size="sm"
                                />
                              )}
                              <span className="text-[12px] text-muted">
                                {evaluation.timeText}
                                {evaluation.weatherDesc ? ` · ${evaluation.weatherDesc}` : ""}
                                {evaluation.t !== null ? ` (${Math.round(evaluation.t)}°C)` : ""}
                              </span>
                            </>
                          ) : (
                            <>
                              <ScoreChip score={null} size="sm" />
                              {item.category === "pantai" && evaluation.seaStatus && (
                                <SeaBadge
                                  status={evaluation.seaStatus}
                                  waveHeight={evaluation.waveHeightMax}
                                  waveCat={evaluation.waveCat}
                                  size="sm"
                                />
                              )}
                              <span className="text-[12px] text-muted">{evaluation.timeText}</span>
                            </>
                          )}
                        </div>

                        {selected && (
                          <div className="mt-2.5 flex items-center justify-between border-t border-hairline/60 pt-2 text-xs text-muted">
                            <span className="inline-flex items-center gap-1.5 font-medium text-link">
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
            </section>

            {/* Footer Attribution */}
            <div className="mt-4 border-t border-hairline pt-4">
              <AttributionBar />
            </div>
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
