"use client";

import { useMemo, useRef, useState } from "react";
import { AttributionBar } from "@/components/attribution-bar";
import { FacilityIcon } from "@/components/icons";
import { MapView, type MapMarker } from "@/components/map/map-view";
import { CATEGORY_LABEL, FACILITY_LABEL, type DestCategory, type FacilityType } from "@/lib/categories";
import { FACILITY_COLOR } from "@/lib/icon-data";
import { formatDistance } from "@/lib/format";

export type FacilityRow = {
  id: number;
  type: FacilityType;
  name: string | null;
  lat: number;
  lon: number;
  distanceM: number;
};

/** Tipe yang ditampilkan di panel ini; halte dan stasiun ada di bagian Akses. */
export const PANEL_TYPES: FacilityType[] = ["toilet", "parkir", "makan", "ibadah", "atm"];
const RADII = [500, 1000, 2000] as const;
const VISIBLE_BY_DEFAULT = 5;
const MAX_MAP_DOTS = 120;

type Props = {
  slug: string;
  destination: { name: string; lat: number; lon: number; category: DestCategory };
  initialRadius: number;
  initialFacilities: FacilityRow[];
  mapStyleUrl: string;
};

export function FacilitiesPanel({ slug, destination, initialRadius, initialFacilities, mapStyleUrl }: Props) {
  const [radius, setRadius] = useState(initialRadius);
  const [facilities, setFacilities] = useState(initialFacilities);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [expanded, setExpanded] = useState<Partial<Record<FacilityType, boolean>>>({});
  const abortRef = useRef<AbortController | null>(null);

  const chooseRadius = async (next: number) => {
    if (next === radius && status !== "error") return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRadius(next);
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/v1/destinations/${encodeURIComponent(slug)}/facilities?radius=${next}&type=${PANEL_TYPES.join(",")}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { facilities: FacilityRow[] };
      setFacilities(body.facilities);
      setStatus("idle");
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setStatus("error");
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<FacilityType, FacilityRow[]>(PANEL_TYPES.map((type) => [type, []]));
    for (const facility of facilities) map.get(facility.type)?.push(facility);
    return map;
  }, [facilities]);

  const markers = useMemo<MapMarker[]>(
    () => [
      {
        id: "destinasi",
        lat: destination.lat,
        lon: destination.lon,
        label: `${destination.name} (lokasi destinasi)`,
        title: destination.name,
        subtitle: `${CATEGORY_LABEL[destination.category]} (lokasi destinasi)`,
        color: "#9a4f2c",
        glyph: destination.category,
        shape: "pin",
        isHero: true,
        heroName: destination.name,
      },
      ...facilities.slice(0, MAX_MAP_DOTS).map((facility) => ({
        id: `f-${facility.id}`,
        lat: facility.lat,
        lon: facility.lon,
        label: `${FACILITY_LABEL[facility.type]}: ${facility.name ?? "tanpa nama"}, ${formatDistance(facility.distanceM)}`,
        title: FACILITY_LABEL[facility.type],
        subtitle: `${facility.name ? facility.name + " · " : ""}${formatDistance(facility.distanceM)}`,
        color: FACILITY_COLOR[facility.type] ?? "#1e2b45",
        glyph: facility.type,
        shape: "circle" as const,
        size: 24,
      })),
    ],
    [destination, facilities],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fasilitas-judul">Fasilitas dalam {formatDistance(radius)}</h2>
        <div role="group" aria-label="Radius pencarian" className="flex gap-2">
          {RADII.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={radius === value}
              onClick={() => chooseRadius(value)}
              className={`min-h-11 min-w-14 rounded-pill border px-3 text-sm font-medium tabular-nums ${
                radius === value
                  ? "border-surface-dark bg-surface-dark text-on-dark"
                  : "border-border-input bg-canvas text-ink hover:bg-surface-soft"
              }`}
            >
              {value === 500 ? "500 m" : `${value / 1000} km`}
            </button>
          ))}
        </div>
      </div>

      <MapView
        className="h-60 overflow-hidden rounded-lg"
        styleUrl={mapStyleUrl}
        markers={markers}
        fitKey={`${slug}-${radius}`}
        getPadding={() => ({ top: 48, bottom: 32, left: 32, right: 32 })}
        cooperativeGestures
        ariaLabel={`Peta fasilitas di sekitar ${destination.name}`}
      />

      <div aria-live="polite" aria-busy={status === "loading"}>
        {status === "error" && (
          <p role="alert" className="rounded-md bg-score-bad-bg px-3 py-2 text-sm font-medium text-score-bad-text">
            Fasilitas gagal dimuat.{" "}
            <button type="button" className="underline" onClick={() => chooseRadius(radius)}>
              Coba lagi
            </button>
          </p>
        )}
        {status === "loading" && <p className="text-sm text-muted">Memuat fasilitas…</p>}
      </div>

      <div className={status === "loading" ? "opacity-60" : undefined}>
        {PANEL_TYPES.map((type) => {
          const rows = grouped.get(type) ?? [];
          const open = expanded[type] ?? false;
          const shown = open ? rows : rows.slice(0, VISIBLE_BY_DEFAULT);
          return (
            <section key={type} aria-label={FACILITY_LABEL[type]} className="border-t border-hairline py-3 first:border-t-0">
              <h3 className="flex items-center gap-2 font-sans text-[13px] font-semibold uppercase tracking-wide text-muted">
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: FACILITY_COLOR[type] }}
                  aria-hidden="true"
                >
                  <FacilityIcon type={type} size={11} />
                </span>
                <span>
                  {FACILITY_LABEL[type]}
                  {rows.length > 0 && <span className="ml-1 font-normal normal-case">({rows.length})</span>}
                </span>
              </h3>
              {rows.length === 0 ? (
                <p className="flex min-h-12 items-center text-[15px] italic text-muted">Belum terpetakan di OpenStreetMap</p>
              ) : (
                <ul>
                  {shown.map((facility) => (
                    <li
                      key={facility.id}
                      className="flex min-h-12 items-center justify-between gap-3 border-b border-hairline last:border-b-0"
                    >
                      <span className="text-[15px] text-body">{facility.name ?? "Tanpa nama"}</span>
                      <span className="shrink-0 text-[15px] tabular-nums text-ink">{formatDistance(facility.distanceM)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {rows.length > VISIBLE_BY_DEFAULT && (
                <button
                  type="button"
                  className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
                  onClick={() => setExpanded((current) => ({ ...current, [type]: !open }))}
                >
                  {open ? "Tampilkan lebih sedikit" : `Tampilkan semua (${rows.length})`}
                </button>
              )}
            </section>
          );
        })}
      </div>

      <AttributionBar sources={["osm", "map"]} />
    </div>
  );
}
