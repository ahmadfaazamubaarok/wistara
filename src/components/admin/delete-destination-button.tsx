"use client";

import { useTransition } from "react";
import { deleteDestinationAction } from "@/app/actions/admin-destinations";

export function DeleteDestinationButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm(`Apakah Anda yakin ingin menghapus destinasi "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      startTransition(async () => {
        const formData = new FormData();
        formData.append("id", id);
        await deleteDestinationAction(formData);
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="rounded px-2.5 py-1 text-xs font-semibold text-score-bad-text hover:bg-score-bad-bg disabled:opacity-50"
    >
      {pending ? "Menghapus…" : "Hapus"}
    </button>
  );
}
