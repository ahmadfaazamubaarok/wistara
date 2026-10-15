"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { DestCategory } from "@/lib/categories";
import { CATEGORY_ICON_PATHS } from "@/lib/icon-data";

export type MapMarker = {
  id: string;
  lat: number;
  lon: number;
  /** Teks untuk pembaca layar dan tooltip. */
  label: string;
  /** Warna isi lingkaran (hex). */
  color: string;
  /** Ikon kategori putih di dalam lingkaran; tanpa ikon = titik polos. */
  glyph?: DestCategory;
  /** Diameter lingkaran dalam px (bawaan 32). */
  size?: number;
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

function tintBaseStyle(map: MapLibreMap) {
  for (const [layerId, property, color] of BASE_TINT) {
    if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, color);
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

function buildMarkerElement(marker: MapMarker, selected: boolean, onSelect?: (id: string) => void) {
  const diameter = selected ? 40 : (marker.size ?? 32);

  // Tombol luar 44px agar area sentuhnya memadai; lingkaran di dalamnya sesuai desain.
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", marker.label);
  button.title = marker.label;
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
  });

  if (marker.glyph) {
    const svg = document.createElementNS(SVG_NS, "svg");
    const iconSize = selected ? 22 : 18;
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(iconSize));
    svg.setAttribute("height", String(iconSize));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    for (const d of CATEGORY_ICON_PATHS[marker.glyph]) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    }
    disc.appendChild(svg);
  }

  button.appendChild(disc);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect?.(marker.id);
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
        tintBaseStyle(map);
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
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Peta dibuat sekali; styleUrl/cooperativeGestures dianggap konstan per tampilan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronkan penanda.
  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!ready || !map || !maplibre) return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = markers.map((marker) => {
      const selected = marker.id === selectedId;
      return new maplibre.Marker({ element: buildMarkerElement(marker, selected, (id) => onSelectRef.current?.(id)) })
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
