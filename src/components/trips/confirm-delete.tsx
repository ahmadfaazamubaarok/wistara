"use client";

import { useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui";

type Props = {
  /** Server Action yang dijalankan setelah pengguna menekan konfirmasi. */
  action: (formData: FormData) => void | Promise<void>;
  /** Nilai tersembunyi untuk Server Action (mis. tripId, itemId). */
  fields: Record<string, string>;
  triggerLabel: ReactNode;
  triggerClassName: string;
  /** Nama tombol pemicu untuk pembaca layar, mis. "Hapus rencana Liburan". */
  triggerAriaLabel: string;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
};

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${buttonClass.secondary} w-full border-transparent bg-score-bad-text text-canvas hover:bg-score-bad-text hover:opacity-90 disabled:opacity-60 md:w-auto`}
    >
      {pending ? "Menghapus…" : label}
    </button>
  );
}

/**
 * Konfirmasi sebelum aksi yang menghapus. Di ponsel tampil sebagai bottom sheet dari bawah layar,
 * di layar lebar sebagai modal di tengah. Memakai <dialog> bawaan: fokus terkunci di dalamnya,
 * Esc menutup, dan fokus kembali ke tombol pemicu. Fokus awal ke "Batal" agar aksi merusak
 * tidak terpicu tak sengaja lewat Enter.
 */
export function ConfirmDelete({
  action,
  fields,
  triggerLabel,
  triggerClassName,
  triggerAriaLabel,
  title,
  description,
  confirmLabel = "Hapus",
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  const open = () => {
    dialogRef.current?.showModal();
    cancelRef.current?.focus();
  };
  const close = () => dialogRef.current?.close();

  const submit = async (formData: FormData) => {
    await action(formData);
    close();
  };

  return (
    <>
      <button type="button" className={triggerClassName} aria-label={triggerAriaLabel} aria-haspopup="dialog" onClick={open}>
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descId}
        // Klik di luar kartu (pada backdrop) menutup dialog.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="confirm-dialog fixed inset-x-0 bottom-0 top-auto w-full max-w-none rounded-t-2xl border border-hairline bg-canvas p-0 text-ink shadow-xl backdrop:bg-black/50 md:inset-0 md:m-auto md:h-fit md:w-[min(28rem,calc(100%-2rem))] md:rounded-2xl"
      >
        <form action={submit} className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-6">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-border-input/60 md:hidden" />
          <div className="flex flex-col gap-2">
            <h2 id={titleId} className="!text-[20px]">
              {title}
            </h2>
            <p id={descId} className="text-[15px] text-body">
              {description}
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <button ref={cancelRef} type="button" onClick={close} className={`${buttonClass.secondary} w-full md:w-auto`}>
              Batal
            </button>
            <ConfirmButton label={confirmLabel} />
          </div>
        </form>
      </dialog>
    </>
  );
}
