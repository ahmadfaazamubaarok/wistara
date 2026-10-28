import Link from "next/link";
import { getPageUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/submissions/service";
import { SiteNav } from "@/components/site-nav";

export async function SiteHeader() {
  const user = await getPageUser();
  // Gagal-aman: header tampil di setiap halaman, jadi galat database tidak boleh menjatuhkannya.
  const admin = user ? await isAdmin(user.id).catch(() => false) : false;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-hairline bg-canvas/95 backdrop-blur-md">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface-dark focus:px-4 focus:py-3 focus:text-on-dark"
      >
        Lewati ke konten utama
      </a>
      <div className="mx-auto flex min-h-14 w-full max-w-[1200px] items-center justify-between gap-3 px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2 text-ink no-underline">
            <svg aria-hidden="true" viewBox="0 0 32 32" width="28" height="28" focusable="false">
              <rect width="32" height="32" rx="8" fill="#1e2b45" />
              <path d="M16 6a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" fill="#faf9f5" />
              <circle cx="16" cy="13" r="2.6" fill="#9a4f2c" />
            </svg>
            <span className="font-serif text-lg font-bold tracking-tight md:text-xl">Wistara</span>
          </Link>
          <span className="hidden h-4 w-px bg-border-input/40 md:inline-block" aria-hidden="true" />
          <span className="hidden text-[13px] text-muted md:inline-block">waktu terbaik wisata</span>
          <span className="hidden rounded-full border border-border-input/30 bg-surface-soft/80 px-2 py-0.5 text-[11px] text-muted lg:inline-block">
            Data BMKG · 3 hari
          </span>
        </div>

        <SiteNav isLoggedIn={user !== null} isAdminUser={admin} />
      </div>
    </header>
  );
}
