"use client";

import { buttonClass } from "@/components/ui";

// Batas galat untuk semua halaman. Detail galat tidak ditampilkan ke pengguna
// (hanya ke log server); pesan di sini sengaja umum.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="konten" className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-start gap-4 px-4 py-12 md:px-8">
      <h1>Halaman ini sedang bermasalah</h1>
      <p className="max-w-[60ch]">
        Kami tidak bisa memuat data saat ini. Ini biasanya sementara. Coba muat ulang; bila tetap gagal, coba beberapa
        menit lagi.
      </p>
      <button type="button" onClick={reset} className={buttonClass.primary}>
        Coba lagi
      </button>
    </main>
  );
}
