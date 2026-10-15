"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveToTripAction, type TripFormState } from "@/app/actions/trips";
import { buttonClass } from "@/components/ui";

export type SlotOption = { value: string; label: string };

type Props = {
  destinationId: string;
  slug: string;
  loggedIn: boolean;
  trips: { id: string; title: string }[];
  slots: SlotOption[];
};

const FIELD = "min-h-11 w-full rounded-md border border-border-input bg-canvas px-3 text-base text-ink";

export function SaveToTrip({ destinationId, slug, loggedIn, trips, slots }: Props) {
  const [state, action, pending] = useActionState<TripFormState, FormData>(saveToTripAction, {});
  const [tripId, setTripId] = useState(trips[0]?.id ?? "baru");

  // F7: yang belum login diarahkan ke login, lalu kembali ke halaman ini.
  if (!loggedIn) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={`/masuk?next=${encodeURIComponent(`/destinasi/${slug}`)}`} className={`${buttonClass.secondary} w-full`}>
          Simpan ke rencana
        </Link>
        <p className="text-[13px] text-muted">Masuk dulu untuk menyimpan destinasi ini beserta slot waktunya.</p>
      </div>
    );
  }

  return (
    <details className="rounded-lg border border-border-input bg-canvas">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-[15px] font-semibold text-ink">
        Simpan ke rencana
      </summary>
      <form action={action} className="flex flex-col gap-4 border-t border-hairline p-4">
        <input type="hidden" name="destinationId" value={destinationId} />
        <input type="hidden" name="slug" value={slug} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pilih-rencana" className="text-sm font-medium text-ink">
            Rencana
          </label>
          <select id="pilih-rencana" name="tripId" value={tripId} onChange={(e) => setTripId(e.target.value)} className={FIELD}>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title}
              </option>
            ))}
            <option value="baru">Buat rencana baru…</option>
          </select>
        </div>

        {tripId === "baru" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="judul-baru" className="text-sm font-medium text-ink">
              Judul rencana baru
            </label>
            <input id="judul-baru" name="newTitle" maxLength={80} required placeholder="mis. Akhir pekan di Jogja" className={FIELD} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pilih-slot" className="text-sm font-medium text-ink">
            Slot waktu
          </label>
          <select id="pilih-slot" name="plannedSlot" defaultValue="" className={FIELD}>
            <option value="">Belum memilih slot</option>
            {slots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </div>

        {state.error && (
          <p role="alert" className="rounded-md bg-score-bad-bg px-3 py-2 text-sm font-medium text-score-bad-text">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={buttonClass.secondary}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
      </form>
    </details>
  );
}
