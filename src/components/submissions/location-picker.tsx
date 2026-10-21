"use client";

// Pemilih lokasi untuk formulir usulan: klik atau seret penanda di peta, pakai lokasi perangkat,
// atau ketik koordinat. Isian koordinat selalu tersedia, jadi pengguna papan ketik dan pembaca
// layar tidak bergantung pada peta, dan peta yang gagal dimuat tidak menghalangi pengiriman.

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  styleUrl: string;
  lat: string;
  lon: string;
  onChange: (lat: string, lon: string) => void;
  /**
   * Dipanggil sekali saat pengguna MEMILIH titik: klik peta, seret penanda, lokasi perangkat, atau
   * selesai mengetik koordinat (blur). Tidak dipanggil di setiap ketukan, dan tidak dua kali untuk
   * titik yang sama. Dipakai untuk mencari alamat.
   */
  onCommit?: (lat: string, lon: string) => void;
  error?: string;
};

const DIY_CENTER: [number, number] = [110.4, -7.85];
const LOAD_TIMEOUT_MS = 12_000;
const INPUT =
  "min-h-11 w-full rounded-md border border-border-input bg-canvas px-3 text-base text-ink placeholder:text-muted";

const toFixed6 = (value: number) => value.toFixed(6);
const parse = (value: string) => (value.trim() === "" ? Number.NaN : Number(value.trim().replace(",", ".")));

export function LocationPicker({ styleUrl, lat, lon, onChange, onCommit, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  // Callback terbaru tanpa membuat ulang peta.
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onChangeRef.current = onChange;
    onCommitRef.current = onCommit;
  }, [onChange, onCommit]);

  // Titik terakhir yang dilaporkan lewat onCommit, agar titik yang sama tidak dicari dua kali.
  const lastCommit = useRef("");
  const commit = useCallback((latitude: string, longitude: string) => {
    const key = `${latitude},${longitude}`;
    if (key === lastCommit.current) return;
    lastCommit.current = key;
    onCommitRef.current?.(latitude, longitude);
  }, []);

  // Peta dibuat sekali.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      maplibreRef.current = maplibre;
      // Berkas worker disajikan dari /vendor (lihat scripts/copy-vendor-assets.mjs).
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

      const map = new maplibre.Map({
        container: containerRef.current,
        style: styleUrl,
        center: DIY_CENTER,
        zoom: 9,
        cooperativeGestures: true,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");

      let loaded = false;
      timer = setTimeout(() => {
        if (!loaded) setMapFailed(true);
      }, LOAD_TIMEOUT_MS);
      map.on("load", () => {
        loaded = true;
        clearTimeout(timer);
        setReady(true);
      });
      map.on("error", () => {
        if (!loaded) setMapFailed(true);
      });
      map.on("click", (event) => {
        const picked = [toFixed6(event.lngLat.lat), toFixed6(event.lngLat.lng)] as const;
        onChangeRef.current(...picked);
        commit(...picked);
      });
    })().catch(() => setMapFailed(true));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // styleUrl dianggap konstan selama formulir tampil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Penanda mengikuti isian koordinat (diketik, diklik di peta, atau dari lokasi perangkat).
  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!ready || !map || !maplibre) return;

    const latitude = parse(lat);
    const longitude = parse(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const marker = new maplibre.Marker({ draggable: true, color: "#9a4f2c" }).setLngLat([longitude, latitude]).addTo(map);
      marker.on("dragend", () => {
        const { lat: la, lng } = marker.getLngLat();
        const picked = [toFixed6(la), toFixed6(lng)] as const;
        onChangeRef.current(...picked);
        commit(...picked);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([longitude, latitude]);
    }
    map.easeTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 14), duration: 500 });
  }, [lat, lon, ready, commit]);

  // Selesai mengetik koordinat: cari alamat bila keduanya angka yang masuk akal.
  const commitTyped = (latitude: string, longitude: string) => {
    const la = parse(latitude);
    const lo = parse(longitude);
    if (Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) commit(latitude.trim(), longitude.trim());
  };

  const useMyLocation = () => {
    setGeoMessage(null);
    if (!("geolocation" in navigator)) {
      setGeoMessage("Perangkat ini tidak mendukung lokasi. Pilih di peta atau isi koordinat.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const picked = [toFixed6(position.coords.latitude), toFixed6(position.coords.longitude)] as const;
        onChange(...picked);
        commit(...picked);
      },
      () => setGeoMessage("Lokasi tidak bisa dibaca. Izinkan akses lokasi, atau pilih di peta."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-lg border border-hairline">
        <div
          ref={containerRef}
          className="h-[300px] w-full bg-surface-soft md:h-[360px]"
          role="group"
          aria-label="Peta untuk memilih lokasi destinasi. Klik peta atau seret penanda. Anda juga dapat mengisi koordinat secara manual di bawah peta."
        />
        {!ready && !mapFailed && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">Memuat peta…</p>
        )}
        {mapFailed && (
          <p role="status" className="absolute inset-x-3 top-3 rounded-md bg-banner-stale-bg px-3 py-2 text-sm font-medium text-banner-stale-text">
            Peta tidak dapat dimuat. Isi koordinat secara manual di bawah.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex min-h-11 items-center rounded-md border border-border-input bg-canvas px-4 text-[15px] font-semibold text-ink hover:bg-surface-soft"
        >
          Gunakan lokasi saya
        </button>
        <p className="text-[13px] text-muted">Klik peta, seret penanda, atau pakai lokasi perangkat bila Anda sedang di tempat.</p>
      </div>
      {geoMessage && (
        <p role="status" className="text-sm text-muted">
          {geoMessage}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="usul-lat" className="text-sm font-medium text-ink">
            Lintang (latitude)
          </label>
          <input
            id="usul-lat"
            name="lat"
            inputMode="decimal"
            autoComplete="off"
            placeholder="-7.797068"
            value={lat}
            onChange={(event) => onChange(event.target.value, lon)}
            onBlur={(event) => commitTyped(event.target.value, lon)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "usul-lokasi-galat" : undefined}
            className={`${INPUT} mt-1`}
          />
        </div>
        <div>
          <label htmlFor="usul-lon" className="text-sm font-medium text-ink">
            Bujur (longitude)
          </label>
          <input
            id="usul-lon"
            name="lon"
            inputMode="decimal"
            autoComplete="off"
            placeholder="110.370529"
            value={lon}
            onChange={(event) => onChange(lat, event.target.value)}
            onBlur={(event) => commitTyped(lat, event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "usul-lokasi-galat" : undefined}
            className={`${INPUT} mt-1`}
          />
        </div>
      </div>
      {error && (
        <p id="usul-lokasi-galat" role="alert" className="text-sm font-medium text-score-bad-text">
          {error}
        </p>
      )}
    </div>
  );
}
