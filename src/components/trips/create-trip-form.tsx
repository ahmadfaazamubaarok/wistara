"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTripAction, type TripFormState } from "@/app/actions/trips";
import { buttonClass } from "@/components/ui";

export function CreateTripForm() {
  const [state, action, pending] = useActionState<TripFormState, FormData>(createTripAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Kosongkan isian setelah berhasil (tidak ada galat dan tidak sedang memproses).
  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <label htmlFor="judul-rencana" className="text-sm font-medium text-ink">
        Judul rencana baru
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="judul-rencana"
          name="title"
          required
          maxLength={80}
          placeholder="mis. Akhir pekan di Jogja"
          className="min-h-11 w-full rounded-md border border-border-input bg-canvas px-3 text-base text-ink placeholder:text-muted"
        />
        <button type="submit" disabled={pending} className={`${buttonClass.secondary} shrink-0`}>
          {pending ? "Menyimpan…" : "Buat rencana"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="rounded-md bg-score-bad-bg px-3 py-2 text-sm font-medium text-score-bad-text">
          {state.error}
        </p>
      )}
    </form>
  );
}
