"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();

  const isUsulan = pathname.startsWith("/admin/usulan");
  const isDestinasi = pathname.startsWith("/admin/destinasi");

  return (
    <nav aria-label="Navigasi admin" className="mb-6 flex gap-2 border-b border-hairline pb-2">
      <Link
        href="/admin/usulan"
        className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
          isUsulan
            ? "bg-primary text-on-primary"
            : "text-muted hover:bg-surface-soft hover:text-ink"
        }`}
      >
        Tinjau Usulan
      </Link>
      <Link
        href="/admin/destinasi"
        className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
          isDestinasi
            ? "bg-primary text-on-primary"
            : "text-muted hover:bg-surface-soft hover:text-ink"
        }`}
      >
        Kelola Destinasi
      </Link>
    </nav>
  );
}
