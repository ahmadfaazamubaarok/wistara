import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { getPageUser } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINK =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-2 text-sm font-medium text-body no-underline hover:bg-surface-soft hover:text-ink md:px-3";

export async function SiteHeader() {
  const user = await getPageUser();

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur-md">
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
            <span className="font-serif text-lg tracking-tight md:text-xl">Wistara</span>
          </Link>
          <span className="hidden h-4 w-px bg-border-input/40 md:inline-block" aria-hidden="true" />
          <span className="hidden text-[13px] text-muted md:inline-block">waktu terbaik wisata</span>
          <span className="hidden rounded-full border border-border-input/30 bg-surface-soft/80 px-2 py-0.5 text-[11px] text-muted lg:inline-block">
            Data BMKG · 3 hari
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <nav aria-label="Navigasi utama">
            <ul className="flex items-center gap-0.5">
              <li>
                <Link href="/" className={`${NAV_LINK} max-sm:hidden`}>
                  Beranda
                </Link>
              </li>
              <li>
                <Link href="/tentang-data" className={NAV_LINK}>
                  Tentang Data
                </Link>
              </li>
              {user ? (
                <>
                  <li>
                    <Link href="/rencana" className={NAV_LINK}>
                      Rencana
                    </Link>
                  </li>
                  <li>
                    <form action={signOutAction}>
                      <button type="submit" className={NAV_LINK}>
                        Keluar
                      </button>
                    </form>
                  </li>
                </>
              ) : (
                <li>
                  <Link href="/masuk" className={NAV_LINK}>
                    Masuk
                  </Link>
                </li>
              )}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
