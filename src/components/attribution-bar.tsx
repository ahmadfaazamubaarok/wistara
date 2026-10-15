import {
  BMKG_ATTRIBUTION,
  BMKG_URL,
  OPENFREEMAP_ATTRIBUTION,
  OPENFREEMAP_URL,
  OSM_ATTRIBUTION,
  OSM_COPYRIGHT_URL,
} from "@/lib/attribution";

type Source = "bmkg" | "osm" | "map";

/**
 * Atribusi sumber data (PRD F8). Wajib tampil di halaman yang memakai datanya,
 * tidak boleh disembunyikan di balik tombol atau menu. `tone="dark"` untuk footer nila.
 */
export function AttributionBar({
  sources = ["bmkg", "osm", "map"],
  tone = "light",
}: {
  sources?: Source[];
  tone?: "light" | "dark";
}) {
  const color = tone === "dark" ? "text-on-dark-soft" : "text-muted";
  const link = tone === "dark" ? "text-on-dark" : "text-muted";
  return (
    <p className={`flex flex-wrap gap-x-3 gap-y-1 text-[13px] leading-snug ${color}`}>
      {sources.includes("bmkg") && (
        <a className={link} href={BMKG_URL} target="_blank" rel="noopener noreferrer">
          {BMKG_ATTRIBUTION}
        </a>
      )}
      {sources.includes("osm") && (
        <a className={link} href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer">
          {OSM_ATTRIBUTION}
        </a>
      )}
      {sources.includes("map") && (
        <a className={link} href={OPENFREEMAP_URL} target="_blank" rel="noopener noreferrer">
          {OPENFREEMAP_ATTRIBUTION}
        </a>
      )}
    </p>
  );
}
