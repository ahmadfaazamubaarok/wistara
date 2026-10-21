import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { removeItemAction, deleteTripAction } from "@/app/actions/trips";
import { CategoryIcon } from "@/components/icons";
import { ScoreChip } from "@/components/score-chip";
import { SiteFooter } from "@/components/site-footer";
import { ConfirmDelete } from "@/components/trips/confirm-delete";
import { CreateTripForm } from "@/components/trips/create-trip-form";
import { buttonClass } from "@/components/ui";
import { getPageUser } from "@/lib/auth/session";
import { CATEGORY_LABEL } from "@/lib/categories";
import { getScoreProfiles, listDestinations } from "@/lib/db/destinations";
import { getDestinationForecast, type DestinationForecast } from "@/lib/forecast/destination-forecast";
import { bestOverlappingSlot, wibDayKeys } from "@/lib/forecast/slots";
import { formatDayKey, relativeDayName } from "@/lib/format";
import { listTrips } from "@/lib/trips/service";
import { formatWibTime, getWibDateKey } from "@/lib/wib";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rencana kunjungan",
  robots: { index: false },
};

export default async function TripsPage() {
  const user = await getPageUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent("/rencana")}`);

  const trips = await listTrips(user.id);
  const now = new Date();
  const dayKeys = wibDayKeys(now, 3);

  // Skor TERKINI untuk setiap destinasi pada slot yang dipilih (F7), dari prakiraan tersimpan.
  const slugs = new Set(trips.flatMap((trip) => trip.items.map((item) => item.destination.slug)));
  const destinations = (await listDestinations()).filter((d) => slugs.has(d.slug));
  const profiles = await getScoreProfiles();
  const forecasts = new Map<string, DestinationForecast>();
  await Promise.all(
    destinations.map(async (destination) => {
      forecasts.set(destination.slug, await getDestinationForecast(destination, { days: 3, now, profiles }));
    }),
  );

  const slotLabel = (iso: string) => {
    const date = new Date(iso);
    const key = getWibDateKey(date);
    const index = dayKeys.indexOf(key);
    const day = index >= 0 ? relativeDayName(index) : formatDayKey(key);
    return `${day}, pukul ${formatWibTime(date)} WIB`;
  };

  return (
    <>
      <main id="konten" className="mx-auto w-full max-w-[860px] flex-1 px-4 py-8 md:px-8 md:py-10">
        <h1>Rencana kunjungan</h1>
        <p className="mt-3 max-w-[65ch]">
          Destinasi dan slot waktu yang Anda simpan. Skor di sini selalu dihitung ulang dari prakiraan terbaru, jadi rencana
          lama pun menunjukkan kondisi terkini.
        </p>
        <p className="mt-1 text-[13px] text-muted">Masuk sebagai {user.email ?? "pengguna"}</p>

        <section aria-labelledby="buat" className="mt-8 rounded-lg bg-surface-card p-4">
          <h2 id="buat" className="!text-[18px]">
            Buat rencana
          </h2>
          <div className="mt-3">
            <CreateTripForm />
          </div>
        </section>

        {trips.length === 0 ? (
          <div className="mt-8 rounded-lg border border-hairline p-6">
            <p className="text-ink">Belum ada rencana.</p>
            <p className="mt-1 text-body">
              Buat rencana di atas, lalu tambahkan destinasi dari halamannya lewat tombol &ldquo;Simpan ke rencana&rdquo;.
            </p>
            <Link href="/" className={`${buttonClass.primary} mt-4`}>
              Jelajahi destinasi
            </Link>
          </div>
        ) : (
          <ul className="mt-8 flex flex-col gap-6">
            {trips.map((trip) => (
              <li key={trip.id}>
                <section aria-labelledby={`rencana-${trip.id}`} className="rounded-lg border border-border-input p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id={`rencana-${trip.id}`} className="!text-[22px]">
                      {trip.title}
                    </h2>
                    <ConfirmDelete
                      action={deleteTripAction}
                      fields={{ tripId: trip.id }}
                      triggerLabel="Hapus rencana"
                      triggerClassName={buttonClass.secondary}
                      triggerAriaLabel={`Hapus rencana ${trip.title}`}
                      title="Hapus rencana ini?"
                      description={
                        <>
                          Rencana <strong className="text-ink">{trip.title}</strong>
                          {trip.items.length > 0 ? ` beserta ${trip.items.length} destinasi di dalamnya` : ""} akan dihapus
                          permanen dan tidak bisa dikembalikan.
                        </>
                      }
                      confirmLabel="Hapus rencana"
                    />
                  </div>

                  {trip.items.length === 0 ? (
                    <p className="mt-3 text-body">Belum ada destinasi di rencana ini.</p>
                  ) : (
                    <ul className="mt-3">
                      {trip.items.map((item) => {
                        const forecast = forecasts.get(item.destination.slug);
                        const planned = item.plannedSlot ? new Date(item.plannedSlot).getTime() : null;
                        const current =
                          forecast && planned !== null ? bestOverlappingSlot(forecast.slots, planned) : undefined;
                        return (
                          <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-hairline py-3">
                            <div className="min-w-0">
                              <Link href={`/destinasi/${item.destination.slug}`} className="font-semibold text-ink">
                                {item.destination.name}
                              </Link>
                              <p className="flex items-center gap-1 text-[13px] text-muted">
                                <CategoryIcon category={item.destination.category} size={14} />
                                {CATEGORY_LABEL[item.destination.category]}
                              </p>
                              <p className="mt-1 text-[15px] text-body">
                                {item.plannedSlot ? slotLabel(item.plannedSlot) : "Belum memilih slot"}
                              </p>
                              {current && current.reasons.length > 0 && (
                                <p className="mt-1 text-[13px] text-muted">{current.reasons.join("; ")}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {item.plannedSlot === null ? null : current ? (
                                <ScoreChip score={current.score} />
                              ) : (
                                <span className="max-w-[14rem] text-right text-[13px] text-muted">
                                  Belum ada prakiraan untuk slot ini (sudah lewat atau di luar 3 hari).
                                </span>
                              )}
                              <ConfirmDelete
                                action={removeItemAction}
                                fields={{ tripId: trip.id, itemId: item.id }}
                                triggerLabel="Hapus"
                                triggerClassName="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-link underline"
                                triggerAriaLabel={`Hapus ${item.destination.name} dari rencana ${trip.title}`}
                                title="Hapus dari rencana?"
                                description={
                                  <>
                                    <strong className="text-ink">{item.destination.name}</strong> akan dihapus dari rencana{" "}
                                    {trip.title}. Rencana lain tidak terpengaruh.
                                  </>
                                }
                                confirmLabel="Hapus destinasi"
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
