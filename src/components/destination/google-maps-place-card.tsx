import { MiscIcon } from "@/components/icons";
import { getGoogleMapsPlaceUrl, getGoogleMapsTransitUrl } from "@/lib/google-maps";

type Props = {
  destination: {
    slug: string;
    name: string;
    lat: number;
    lon: number;
    kabupaten?: string;
  };
  routeUrl: string;
};

export function GoogleMapsPlaceCard({ destination, routeUrl }: Props) {
  const mapsSearchUrl = getGoogleMapsPlaceUrl(destination.name, destination.kabupaten);
  const transitUrl = getGoogleMapsTransitUrl(destination.lat, destination.lon);

  return (
    <section
      aria-labelledby="gmaps-link-title"
      className="rounded-lg border border-hairline bg-surface-card p-4 transition-colors hover:border-border-input"
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail Link Google Maps */}
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-input/60 bg-surface-soft text-link"
          aria-hidden="true"
        >
          {/* Ikon Pin Google Maps bersih */}
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
              maps.google.com
            </span>
          </div>

          <h2 id="gmaps-link-title" className="mt-0.5 text-sm font-semibold text-ink">
            {destination.name} di Google Maps
          </h2>

          <p className="mt-1 text-xs leading-relaxed text-body">
            Buka profil tempat ini di Google Maps untuk melihat ulasan pengunjung, foto kontributor,
            jam buka terkini, dan panduan rute.
          </p>
        </div>
      </div>

      {/* Tombol Tautan */}
      <div className="mt-3.5 flex flex-wrap gap-2 border-t border-hairline/70 pt-3">
        <a
          href={mapsSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-input bg-canvas px-3 text-xs font-semibold text-ink hover:bg-surface-soft transition-colors"
        >
          <span>Buka di Google Maps</span>
          <MiscIcon name="externalLink" size={13} />
          <span className="sr-only">(tab baru)</span>
        </a>

        <a
          href={transitUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border-input/70 px-3 text-xs font-medium text-ink hover:bg-surface-soft transition-colors"
        >
          <span>Rute Angkutan Umum</span>
          <MiscIcon name="externalLink" size={13} />
        </a>

        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted hover:text-ink transition-colors"
        >
          <span>Petunjuk Arah</span>
          <MiscIcon name="externalLink" size={13} />
        </a>
      </div>
    </section>
  );
}
