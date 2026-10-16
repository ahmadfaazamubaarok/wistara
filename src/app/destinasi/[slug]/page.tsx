import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AttributionBar } from "@/components/attribution-bar";
import { FacilitiesPanel, PANEL_TYPES } from "@/components/destination/facilities-panel";
import { SlotExplorer } from "@/components/destination/slot-explorer";
import { MiscIcon } from "@/components/icons";
import { ScoreChip } from "@/components/score-chip";
import { SiteFooter } from "@/components/site-footer";
import { SaveToTrip } from "@/components/trips/save-to-trip";
import { buttonClass, StatusBanner } from "@/components/ui";
import { getPageUser } from "@/lib/auth/session";
import { listTrips } from "@/lib/trips/service";
import { toSlotDto, type SlotDto } from "@/lib/api/dto";
import { googleMapsRouteUrl } from "@/lib/api/http";
import { slugParams } from "@/lib/api/schemas";
import { CATEGORY_LABEL } from "@/lib/categories";
import { createDemoAlert, getActiveAlertsForDestination } from "@/lib/db/alerts";
import { facilitiesNear, getDestinationBySlug } from "@/lib/db/destinations";
import { alternativesBySlot, bestOtherSlot, isAlternativeTrigger } from "@/lib/forecast/alternatives";
import { getDestinationForecast } from "@/lib/forecast/destination-forecast";
import { formatDistance, formatWibDateTime, relativeDayName, slotHour, summarizeOpenHours } from "@/lib/format";
import { DEFAULT_VISIT_WINDOW } from "@/lib/scoring/open-hours";

export const dynamic = "force-dynamic";

const DEFAULT_MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
/** Halte/stasiun dicari lebih jauh daripada fasilitas lain (impor OSM: halte 1,5 km, stasiun 5 km). */
const ACCESS_RADIUS_M = 5000;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview_alert?: string; demo_alert?: string }>;
};

// Satu kali baca per permintaan walau dipanggil oleh generateMetadata dan halaman.
const loadDestination = cache(async (slug: string) =>
  slugParams.safeParse({ slug }).success ? getDestinationBySlug(slug) : null,
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const destination = await loadDestination(slug);
  if (!destination) return { title: "Destinasi tidak ditemukan" };
  return {
    title: destination.name,
    description: `Waktu terbaik mengunjungi ${destination.name}, prakiraan cuaca 3 hari, fasilitas sekitar, dan saran saat hujan.`,
  };
}

export default async function DestinationPage({ params, searchParams }: Props) {
  const [resolvedParams, search] = await Promise.all([params, searchParams]);
  const slug = resolvedParams.slug;
  const destination = await loadDestination(slug);
  if (!destination) notFound();

  const now = new Date();
  const allowDemo = process.env.NODE_ENV !== "production";
  const isDemoAlert = allowDemo && (search?.preview_alert === "1" || search?.demo_alert === "1");

  const [forecast, nearby, access, activeAlerts] = await Promise.all([
    getDestinationForecast(destination, { days: 3, now }),
    facilitiesNear(destination.id, 1000, PANEL_TYPES),
    facilitiesNear(destination.id, ACCESS_RADIUS_M, ["halte", "stasiun"]),
    getActiveAlertsForDestination(destination, now),
  ]);

  const alerts = isDemoAlert && activeAlerts.length === 0 ? [createDemoAlert(destination, now)] : activeAlerts;
  const altMap = await alternativesBySlot(destination, forecast.slots, now);

  // "Simpan ke rencana" (F7): yang belum login diarahkan ke login lalu kembali ke halaman ini.
  const user = await getPageUser();
  const myTrips = user ? (await listTrips(user.id)).map((trip) => ({ id: trip.id, title: trip.title })) : [];
  const slotOptions = forecast.slots
    .filter((slot) => slot.isOpen && slot.score !== null)
    .map((slot) => ({
      value: slot.validAt,
      label: `${relativeDayName(forecast.dayKeys.indexOf(slot.localTime.slice(0, 10)))}, pukul ${slotHour(slot.localTime)} WIB (skor ${slot.score})`,
    }));

  const slots = forecast.slots.map((slot) => toSlotDto(slot, (altMap.get(slot.validAt)?.length ?? 0) > 0));
  const alternatives = Object.fromEntries(altMap);
  const otherSlots: Record<string, SlotDto | null> = {};
  for (const slot of forecast.slots) {
    if (isAlternativeTrigger(slot) && (altMap.get(slot.validAt)?.length ?? 0) === 0) {
      const other = bestOtherSlot(forecast.slots, slot);
      otherSlots[slot.validAt] = other ? toSlotDto(other, false) : null;
    }
  }

  // Waktu terbaik di seluruh 3 hari (seri: yang lebih awal).
  let overall: (typeof forecast.bestByDay)[number] = null;
  for (const best of forecast.bestByDay) {
    if (best && (!overall || best.score > overall.score)) overall = best;
  }
  const overallDayIndex = overall ? forecast.dayKeys.indexOf(overall.date) : -1;
  const initialValidAt = overall ? (slots.find((slot) => slot.localTime === overall.localTime)?.validAt ?? null) : null;

  const nearestHalte = access.find((f) => f.type === "halte");
  const nearestStasiun = access.find((f) => f.type === "stasiun");
  const hoursLines = destination.openHours ? summarizeOpenHours(destination.openHours) : [];
  const { source } = forecast;

  return (
    <>
      <main id="konten" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:px-8 md:py-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium">
          <span aria-hidden="true">←</span> Semua destinasi
        </Link>

        <div className="mt-2 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="flex min-w-0 flex-col gap-6">
            <header className="flex flex-col gap-1">
              <h1>{destination.name}</h1>
              <p className="text-[13px] text-muted">
                {CATEGORY_LABEL[destination.category]} · {destination.region.kabupaten} · {destination.region.desa},{" "}
                {destination.region.kecamatan}
              </p>
              {destination.description && <p className="mt-2 max-w-[65ch]">{destination.description}</p>}
            </header>

            {/* PRD F10: Banner Peringatan Dini Cuaca Ekstrem BMKG */}
            {alerts.length > 0 && (
              <div className="flex flex-col gap-2">
                {alerts.map((alert) => (
                  <StatusBanner key={alert.capId} kind="alert">
                    <div className="flex flex-col gap-1 text-sm">
                      <strong className="block font-semibold text-ink">{alert.headline || alert.event}</strong>
                      <p className="leading-relaxed">{alert.description}</p>
                      {alert.instruction && <p className="text-[12px] opacity-90">{alert.instruction}</p>}
                      <p className="mt-0.5 text-[12px] opacity-80">
                        Masa berlaku: {formatWibDateTime(alert.effective)} – {formatWibDateTime(alert.expires)} WIB (Sumber: BMKG)
                      </p>
                    </div>
                  </StatusBanner>
                ))}
              </div>
            )}

            {source.isStale && (
              <StatusBanner kind="stale">
                Data belum diperbarui.{" "}
                {source.fetchedAt
                  ? `Prakiraan terakhir berhasil diambil ${formatWibDateTime(source.fetchedAt)}.`
                  : "Prakiraan belum pernah berhasil diambil."}
              </StatusBanner>
            )}

            <section aria-labelledby="terbaik-judul" className="flex flex-col gap-3">
              <h2 id="terbaik-judul">
                {overall ? `Waktu terbaik: ${relativeDayName(overallDayIndex).toLowerCase()}` : "Waktu terbaik"}
              </h2>
              {overall ? (
                <div className="flex flex-wrap items-center gap-3">
                  <ScoreChip score={overall.score} />
                  <span className="text-ink">pukul {slotHour(overall.localTime)} WIB</span>
                </div>
              ) : (
                <p className="text-body">Belum ada slot yang buka dengan prakiraan tersedia dalam 3 hari ke depan.</p>
              )}
            </section>

            <section aria-labelledby="slot-judul" className="flex flex-col gap-3">
              <h2 id="slot-judul">Prakiraan per 3 jam</h2>
              <SlotExplorer
                dayKeys={forecast.dayKeys}
                slots={slots}
                alternatives={alternatives}
                otherSlots={otherSlots}
                initialValidAt={initialValidAt}
              />
              <p className="text-[13px] text-muted">
                {source.analysisDate && <>Prakiraan diproduksi BMKG {formatWibDateTime(source.analysisDate)}. </>}
                Skor adalah rekomendasi berbasis prakiraan, bukan jaminan kondisi di lokasi.{" "}
                <Link href="/tentang-data">Cara skor dihitung</Link>.
              </p>
              <AttributionBar sources={["bmkg"]} />
            </section>

            <section aria-labelledby="jam-judul" className="rounded-lg bg-surface-card p-4">
              <h2 id="jam-judul" className="!text-[18px]">
                Jam buka
              </h2>
              {destination.openHours ? (
                <ul className="mt-2 text-body">
                  {hoursLines.map((line) => (
                    <li key={line} className="tabular-nums">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-body">
                  Tidak ada jam buka tetap. Untuk menilai slot, dipakai jendela kunjungan {DEFAULT_VISIT_WINDOW[0].replace(":", ".")}–
                  {DEFAULT_VISIT_WINDOW[1].replace(":", ".")} WIB.
                </p>
              )}
              {destination.verifiedAt === null ? (
                <p className="mt-2 flex items-start gap-2 text-[13px] text-muted">
                  <span className="mt-0.5 shrink-0">
                    <MiscIcon name="info" size={16} />
                  </span>
                  Jam buka belum diverifikasi ke pengelola. Cek informasi resmi sebelum berangkat.
                </p>
              ) : (
                <p className="mt-2 text-[13px] text-muted">Terakhir diverifikasi {destination.verifiedAt}.</p>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-8">
            <FacilitiesPanel
              slug={destination.slug}
              destination={{ name: destination.name, lat: destination.lat, lon: destination.lon, category: destination.category }}
              initialRadius={1000}
              initialFacilities={nearby}
              mapStyleUrl={process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE}
            />

            <section aria-labelledby="akses-judul" className="flex flex-col gap-3">
              <h2 id="akses-judul">Akses</h2>
              <dl className="flex flex-col">
                <div className="flex min-h-12 items-center justify-between gap-3 border-b border-hairline">
                  <dt className="text-[15px] text-muted">Halte terdekat</dt>
                  <dd className="text-right text-[15px] text-body">
                    {nearestHalte ? (
                      <>
                        {nearestHalte.name ?? "Halte tanpa nama"} ·{" "}
                        <span className="tabular-nums text-ink">{formatDistance(nearestHalte.distanceM)}</span>
                      </>
                    ) : (
                      <span className="italic text-muted">Belum terpetakan di OpenStreetMap dalam 5 km</span>
                    )}
                  </dd>
                </div>
                <div className="flex min-h-12 items-center justify-between gap-3 border-b border-hairline">
                  <dt className="text-[15px] text-muted">Stasiun terdekat</dt>
                  <dd className="text-right text-[15px] text-body">
                    {nearestStasiun ? (
                      <>
                        {nearestStasiun.name ?? "Stasiun tanpa nama"} ·{" "}
                        <span className="tabular-nums text-ink">{formatDistance(nearestStasiun.distanceM)}</span>
                      </>
                    ) : (
                      <span className="italic text-muted">Belum terpetakan di OpenStreetMap dalam 5 km</span>
                    )}
                  </dd>
                </div>
              </dl>
              <a
                className={`${buttonClass.primary} w-full`}
                href={googleMapsRouteUrl(destination.lat, destination.lon)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Buka rute di Google Maps
                <MiscIcon name="externalLink" size={16} />
                <span className="sr-only">(tab baru)</span>
              </a>
              <SaveToTrip
                destinationId={destination.id}
                slug={destination.slug}
                loggedIn={user !== null}
                trips={myTrips}
                slots={slotOptions}
              />
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
