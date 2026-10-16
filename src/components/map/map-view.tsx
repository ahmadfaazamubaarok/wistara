"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { DestCategory, FacilityType } from "@/lib/categories";
import { CATEGORY_ICON_PATHS, FACILITY_ICON_PATHS } from "@/lib/icon-data";

export type MapMarker = {
  id: string;
  lat: number;
  lon: number;
  /** Teks untuk pembaca layar (accessibility). */
  label: string;
  /** Warna isi lingkaran (hex). */
  color: string;
  /** Ikon kategori atau fasilitas putih di dalam lingkaran/pin; tanpa ikon = titik polos. */
  glyph?: DestCategory | FacilityType;
  /** Bentuk penanda: "pin" (tetesan air penanda peta khas untuk wisata) atau "circle" (lingkaran kompak untuk fasilitas). */
  shape?: "pin" | "circle";
  /** Diameter lingkaran dalam px (bawaan 32). */
  size?: number;
  /** Judul khusus untuk tooltip mengambang estetik. */
  title?: string;
  /** Subjudul (misal: "Pantai · Bantul" atau jarak fasilitas). */
  subtitle?: string;
  /** Skor kelayakan (0-100) atau null bila tutup/tanpa prakiraan. */
  score?: number | null;
  /** Label status skor (misal: "Sangat Baik", "Baik", "Tutup"). */
  scoreLabel?: string;
  /** Kategori warna status (good, mid, bad, closed). */
  band?: "good" | "mid" | "bad" | "closed";
  /** Teks badge alternatif jika score null (misal: "Tutup"). */
  badgeText?: string;
  /** Detail cuaca/waktu (misal: "pukul 12.00 · Cerah Berawan (29°C)"). */
  weatherText?: string;
};

type Props = {
  styleUrl: string;
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Ubah nilainya untuk memaksa peta menyesuaikan tampilan ke semua penanda. */
  fitKey?: string;
  /** Margin saat menyesuaikan tampilan; fungsi agar bisa dihitung dari ukuran layar saat dipakai. */
  getPadding?: () => { top: number; bottom: number; left: number; right: number };
  /** Pada peta kecil di halaman gulir: dua jari untuk menggeser, agar gulir halaman tidak terjebak. */
  cooperativeGestures?: boolean;
  ariaLabel: string;
  className?: string;
};

// Warna lapisan dasar disesuaikan ke palet desain (krem dan nila pucat).
// Id layer mengikuti style Positron OpenFreeMap; id yang tidak ada dilewati.
type TintProperty = "background-color" | "fill-color" | "fill-outline-color";
const BASE_TINT: [layerId: string, property: TintProperty, color: string][] = [
  ["background", "background-color", "#f3eee4"],
  ["water", "fill-color", "#cdd6e6"],
  ["park", "fill-color", "#e4e7d8"],
  ["landcover_wood", "fill-color", "#dadfd0"],
  ["landuse_residential", "fill-color", "#ece6da"],
  ["building", "fill-color", "#e7e0d3"],
  ["building", "fill-outline-color", "#d8d0c0"],
  ["road_area_pier", "fill-color", "#f3eee4"],
];

const DARK_BASE_TINT: [layerId: string, property: TintProperty, color: string][] = [
  ["background", "background-color", "#161513"],
  ["water", "fill-color", "#1e2838"],
  ["park", "fill-color", "#1a241b"],
  ["landcover_wood", "fill-color", "#1b211a"],
  ["landuse_residential", "fill-color", "#1e1c19"],
  ["building", "fill-color", "#24211d"],
  ["building", "fill-outline-color", "#2f2b26"],
  ["road_area_pier", "fill-color", "#161513"],
];

function tintBaseStyle(map: MapLibreMap, isDark: boolean = false) {
  const tint = isDark ? DARK_BASE_TINT : BASE_TINT;
  for (const [layerId, property, color] of tint) {
    if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, color);
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

function createPopupContent(marker: MapMarker): HTMLElement {
  const container = document.createElement("div");
  container.className = "wistara-tooltip-inner";

  // Judul
  const title = document.createElement("div");
  title.className = "wistara-tooltip-title";
  title.textContent = marker.title ?? marker.label.split(",")[0];
  container.appendChild(title);

  // Subtitle (Kategori · Kabupaten / Jarak)
  const subtitleText = marker.subtitle ?? (marker.label.split(",")[1]?.trim() || "");
  if (subtitleText) {
    const sub = document.createElement("div");
    sub.className = "wistara-tooltip-sub";
    sub.textContent = subtitleText;
    container.appendChild(sub);
  }

  // Baris status / skor jika ada
  if (marker.score !== undefined && marker.score !== null) {
    const statusRow = document.createElement("div");
    statusRow.className = "wistara-tooltip-status";

    const chip = document.createElement("span");
    const band = marker.band ?? "good";
    chip.className = `wistara-tooltip-chip wistara-band-${band}`;
    chip.textContent = `★ ${marker.score}${marker.scoreLabel ? ` · ${marker.scoreLabel}` : ""}`;
    statusRow.appendChild(chip);

    if (marker.weatherText) {
      const weather = document.createElement("span");
      weather.className = "wistara-tooltip-weather";
      weather.textContent = marker.weatherText;
      statusRow.appendChild(weather);
    }

    container.appendChild(statusRow);
  } else if (marker.badgeText || marker.band === "closed") {
    const statusRow = document.createElement("div");
    statusRow.className = "wistara-tooltip-status";

    const chip = document.createElement("span");
    const band = marker.band ?? "closed";
    chip.className = `wistara-tooltip-chip wistara-band-${band}`;
    chip.textContent = marker.badgeText ?? "Tutup";
    statusRow.appendChild(chip);

    if (marker.weatherText) {
      const weather = document.createElement("span");
      weather.className = "wistara-tooltip-weather";
      weather.textContent = marker.weatherText;
      statusRow.appendChild(weather);
    }

    container.appendChild(statusRow);
  }

  return container;
}

export function isPinMarker(marker: MapMarker): boolean {
  if (marker.shape) return marker.shape === "pin";
  return !marker.id.startsWith("f-");
}

function buildMarkerElement(
  marker: MapMarker,
  selected: boolean,
  onSelect?: (id: string) => void,
  onHover?: (marker: MapMarker) => void,
  onLeave?: () => void,
) {
  const isPin = isPinMarker(marker);

  if (isPin) {
    const pinWidth = selected ? 38 : 30;
    const pinHeight = selected ? 48 : 38;

    // Tombol luar 44x48px agar area sentuh ramah ponsel (WCAG 44px min)
    const btnWidth = Math.max(44, pinWidth);
    const btnHeight = Math.max(48, pinHeight);

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", marker.label);
    Object.assign(button.style, {
      width: `${btnWidth}px`,
      height: `${btnHeight}px`,
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-end",
      padding: "0",
      border: "0",
      background: "transparent",
      cursor: "pointer",
      overflow: "visible",
    });

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 32 42");
    svg.setAttribute("width", String(pinWidth));
    svg.setAttribute("height", String(pinHeight));
    Object.assign(svg.style, {
      display: "block",
      overflow: "visible",
      filter: selected
        ? "drop-shadow(0 4px 8px rgba(20,20,19,0.38))"
        : "drop-shadow(0 3px 6px rgba(20,20,19,0.26))",
      transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
      transformOrigin: "bottom center",
    });

    // Jalur pin khas (teardrop pin: kepala melingkar, meruncing ke titik koordinat di bawah)
    const pinPath = document.createElementNS(SVG_NS, "path");
    pinPath.setAttribute("d", "M16 41 C10 27 2 22 2 16 A 14 14 0 0 1 30 16 C 30 22 22 27 16 41 Z");
    pinPath.setAttribute("fill", marker.color);
    pinPath.setAttribute("stroke", "#ffffff");
    pinPath.setAttribute("stroke-width", selected ? "2.5" : "2");
    pinPath.setAttribute("stroke-linejoin", "round");
    svg.appendChild(pinPath);

    if (marker.glyph) {
      const paths =
        (marker.glyph in CATEGORY_ICON_PATHS
          ? CATEGORY_ICON_PATHS[marker.glyph as DestCategory]
          : FACILITY_ICON_PATHS[marker.glyph as FacilityType]) ?? [];

      if (paths.length > 0) {
        // Ikon kategori di dalam kepala pin (pusat x=16, y=16)
        const iconSvg = document.createElementNS(SVG_NS, "svg");
        iconSvg.setAttribute("x", "7");
        iconSvg.setAttribute("y", "7");
        iconSvg.setAttribute("width", "18");
        iconSvg.setAttribute("height", "18");
        iconSvg.setAttribute("viewBox", "0 0 24 24");
        iconSvg.setAttribute("fill", "none");
        iconSvg.setAttribute("stroke", "#ffffff");
        iconSvg.setAttribute("stroke-width", "2.2");
        iconSvg.setAttribute("stroke-linecap", "round");
        iconSvg.setAttribute("stroke-linejoin", "round");
        iconSvg.setAttribute("aria-hidden", "true");
        for (const d of paths) {
          const path = document.createElementNS(SVG_NS, "path");
          path.setAttribute("d", d);
          iconSvg.appendChild(path);
        }
        svg.appendChild(iconSvg);
      }
    }

    button.appendChild(svg);

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect?.(marker.id);
    });

    button.addEventListener("mouseenter", () => {
      svg.style.transform = "scale(1.15)";
      onHover?.(marker);
    });
    button.addEventListener("mouseleave", () => {
      svg.style.transform = "scale(1)";
      onLeave?.();
    });
    button.addEventListener("focus", () => {
      svg.style.transform = "scale(1.15)";
      onHover?.(marker);
    });
    button.addEventListener("blur", () => {
      svg.style.transform = "scale(1)";
      onLeave?.();
    });

    return button;
  }

  // --- Penanda lingkaran (fasilitas / titik kompak) ---
  const diameter = selected ? 40 : (marker.size ?? 24);

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", marker.label);
  Object.assign(button.style, {
    width: `${Math.max(44, diameter)}px`,
    height: `${Math.max(44, diameter)}px`,
    display: "grid",
    placeItems: "center",
    padding: "0",
    border: "0",
    background: "transparent",
    cursor: "pointer",
  });

  const disc = document.createElement("span");
  Object.assign(disc.style, {
    width: `${diameter}px`,
    height: `${diameter}px`,
    borderRadius: "9999px",
    background: marker.color,
    border: "2px solid #ffffff",
    boxSizing: "border-box",
    display: "grid",
    placeItems: "center",
    color: "#ffffff",
    boxShadow: selected ? "0 2px 6px rgba(20,20,19,0.25)" : "none",
    transition: "transform 0.15s ease",
  });

  if (marker.glyph) {
    const paths =
      (marker.glyph in CATEGORY_ICON_PATHS
        ? CATEGORY_ICON_PATHS[marker.glyph as DestCategory]
        : FACILITY_ICON_PATHS[marker.glyph as FacilityType]) ?? [];

    if (paths.length > 0) {
      const svg = document.createElementNS(SVG_NS, "svg");
      const iconSize = selected ? Math.round(diameter * 0.6) : Math.round(diameter * 0.55);
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", String(iconSize));
      svg.setAttribute("height", String(iconSize));
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      for (const d of paths) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", d);
        svg.appendChild(path);
      }
      disc.appendChild(svg);
    }
  }

  button.appendChild(disc);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect?.(marker.id);
  });

  // Tampilkan keterangan melayang estetik saat kursor menyentuh/fokus
  button.addEventListener("mouseenter", () => {
    disc.style.transform = "scale(1.12)";
    onHover?.(marker);
  });
  button.addEventListener("mouseleave", () => {
    disc.style.transform = "scale(1)";
    onLeave?.();
  });
  button.addEventListener("focus", () => {
    disc.style.transform = "scale(1.12)";
    onHover?.(marker);
  });
  button.addEventListener("blur", () => {
    disc.style.transform = "scale(1)";
    onLeave?.();
  });

  return button;
}

const LOAD_TIMEOUT_MS = 15_000;

export function MapView({
  styleUrl,
  markers,
  selectedId,
  onSelect,
  fitKey,
  getPadding,
  cooperativeGestures = false,
  ariaLabel,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const hoverPopupRef = useRef<import("maplibre-gl").Popup | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Callback terbaru tanpa memicu pembuatan ulang peta.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Inisialisasi peta sekali.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      maplibreRef.current = maplibre;
      // Bundler tidak menemukan berkas worker MapLibre; disajikan dari /vendor (lihat scripts/copy-vendor-assets.mjs).
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

      const map = new maplibre.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [110.4, -7.85], // DIY
        zoom: 9,
        cooperativeGestures,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

      let loaded = false;
      timer = setTimeout(() => {
        if (!loaded) setFailed(true);
      }, LOAD_TIMEOUT_MS);

      map.on("load", () => {
        loaded = true;
        clearTimeout(timer);
        const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
        tintBaseStyle(map, isDark);
        setReady(true);
      });
      // Galat sebelum style termuat = peta dasar tidak tersedia. Daftar tetap bisa dipakai.
      map.on("error", () => {
        if (!loaded) setFailed(true);
      });
    })().catch(() => setFailed(true));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Peta dibuat sekali; styleUrl/cooperativeGestures dianggap konstan per tampilan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Perbarui palet warna peta dasar saat tema berubah
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const applyTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      tintBaseStyle(map, isDark);
    };

    window.addEventListener("wistara-theme-change", applyTheme);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          applyTheme();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      window.removeEventListener("wistara-theme-change", applyTheme);
      observer.disconnect();
    };
  }, [ready]);

  // Tutup tooltip saat peta digeser atau dizoom
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const hidePopup = () => hoverPopupRef.current?.remove();
    map.on("dragstart", hidePopup);
    map.on("zoomstart", hidePopup);
    return () => {
      map.off("dragstart", hidePopup);
      map.off("zoomstart", hidePopup);
    };
  }, [ready]);

  // Sinkronkan penanda.
  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!ready || !map || !maplibre) return;

    if (!hoverPopupRef.current) {
      hoverPopupRef.current = new maplibre.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 18,
        className: "wistara-map-popup",
      });
    }

    const handleHover = (marker: MapMarker) => {
      const popup = hoverPopupRef.current;
      if (!map || !popup) return;
      const content = createPopupContent(marker);
      const isPin = isPinMarker(marker);
      const offset = isPin ? (marker.id === selectedId ? 56 : 46) : (marker.id === selectedId ? 24 : 18);
      popup
        .setLngLat([marker.lon, marker.lat])
        .setOffset(offset)
        .setDOMContent(content)
        .addTo(map);
    };

    const handleLeave = () => {
      hoverPopupRef.current?.remove();
    };

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = markers.map((marker) => {
      const selected = marker.id === selectedId;
      const isPin = isPinMarker(marker);
      return new maplibre.Marker({
        element: buildMarkerElement(
          marker,
          selected,
          (id) => onSelectRef.current?.(id),
          handleHover,
          handleLeave,
        ),
        anchor: isPin ? "bottom" : "center",
      })
        .setLngLat([marker.lon, marker.lat])
        .addTo(map);
    });
  }, [markers, selectedId, ready]);

  // Sesuaikan tampilan ke semua penanda saat kunci berubah.
  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!ready || !map || !maplibre || markers.length === 0) return;

    const bounds = new maplibre.LngLatBounds();
    markers.forEach((marker) => bounds.extend([marker.lon, marker.lat]));
    map.fitBounds(bounds, {
      padding: getPadding?.() ?? { top: 48, bottom: 48, left: 48, right: 48 },
      maxZoom: 13,
      duration: 400,
    });
    // markers sengaja tidak masuk dependensi: hanya fitKey yang memicu penyesuaian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready]);

  // Pusatkan pada penanda terpilih.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedId) return;
    const target = markers.find((marker) => marker.id === selectedId);
    if (target) map.easeTo({ center: [target.lon, target.lat], duration: 350 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  return (
    <div className={`relative ${className ?? ""}`}>
      {/* MapLibre memberi kelas `position: relative` pada kontainernya, yang menimpa `absolute`;
          karena itu kontainer dibungkus lapisan absolut dan diberi tinggi penuh. */}
      <div className="absolute inset-0">
        <div ref={containerRef} role="region" aria-label={ariaLabel} className="h-full w-full" />
      </div>
      {failed && (
        <div
          role="status"
          className="absolute inset-0 z-10 flex items-center justify-center bg-surface-soft p-6 text-center text-sm text-body"
        >
          Peta dasar tidak dapat dimuat saat ini. Daftar destinasi dan fasilitas tetap bisa dipakai seperti biasa.
        </div>
      )}
    </div>
  );
}
