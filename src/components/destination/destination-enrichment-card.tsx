import type { DestinationEnrichment } from "@/lib/destination-enrichment";

type Props = {
  enrichment: DestinationEnrichment;
  destinationName: string;
};

export function DestinationEnrichmentCard({ enrichment, destinationName }: Props) {
  const { ticketPrice, highlights, tips, tags, bestTimeNote } = enrichment;

  return (
    <section
      aria-labelledby="info-praktis-heading"
      className="flex flex-col gap-5 rounded-xl border border-hairline bg-surface-card/70 p-5 md:p-6 shadow-xs"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="info-praktis-heading" className="font-sans text-[18px] font-semibold text-ink">
            Informasi Praktis & Panduan Kunjungan
          </h2>
          <span className="rounded-full bg-surface-soft px-2.5 py-0.5 text-[11px] font-medium text-muted">
            Info Terkurasi
          </span>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Karakteristik destinasi">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border border-hairline bg-canvas/80 px-2 py-0.5 text-[12px] font-medium text-body"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* HTM & Parkir */}
      <div className="flex flex-col gap-2">
        <h3 className="font-sans text-[14px] font-semibold text-ink">Tiket Masuk & Parkir</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col rounded-lg border border-hairline/80 bg-canvas/60 p-3">
            <span className="text-[12px] text-muted">Tiket Wisatawan Domestik</span>
            <span className="text-[13px] font-medium text-ink">{ticketPrice.domestic}</span>
          </div>

          {ticketPrice.international && (
            <div className="flex flex-col rounded-lg border border-hairline/80 bg-canvas/60 p-3">
              <span className="text-[12px] text-muted">Tiket Wisatawan Mancanegara</span>
              <span className="text-[13px] font-medium text-ink">{ticketPrice.international}</span>
            </div>
          )}

          {ticketPrice.parking && (
            <div className="flex flex-col rounded-lg border border-hairline/80 bg-canvas/60 p-3 sm:col-span-2">
              <span className="text-[12px] text-muted">Estimasi Biaya Parkir</span>
              <span className="text-[13px] font-medium text-ink">{ticketPrice.parking}</span>
            </div>
          )}
        </div>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-sans text-[14px] font-semibold text-ink">Daya Tarik & Aktivitas Utama</h3>
          <ul className="flex flex-col gap-1.5 text-[13px] text-body">
            {highlights.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips Berkunjung */}
      {tips.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-soft/60 p-3.5">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <span aria-hidden="true">💡</span> Tips Praktis Berkunjung
          </div>
          <ul className="flex flex-col gap-1.5 text-[12px] leading-relaxed text-body">
            {tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-muted" aria-hidden="true">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          {bestTimeNote && (
            <p className="mt-1 border-t border-hairline/60 pt-2 text-[12px] text-muted">
              <strong className="font-medium text-ink">Waktu rekomendasi suasana:</strong> {bestTimeNote} (padukan dengan skor cuaca di atas)
            </p>
          )}
        </div>
      )}
    </section>
  );
}
