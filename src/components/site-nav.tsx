"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINK =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-body no-underline transition-colors hover:bg-surface-soft hover:text-ink";

const MOBILE_LINK =
  "flex min-h-12 w-full items-center justify-between rounded-lg px-4 text-base font-medium text-body no-underline transition-colors hover:bg-surface-soft hover:text-ink active:bg-surface-card";

type Props = {
  isLoggedIn: boolean;
  isAdminUser: boolean;
};

export function SiteNav({ isLoggedIn, isAdminUser }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => setIsOpen(false);

  // Tutup menu saat tombol Escape ditekan atau klik di luar
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    // Kunci scroll body saat menu mobile terbuka
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
      {/* Navigasi Desktop (Horizontal) */}
      <nav aria-label="Navigasi utama desktop" className="hidden md:block">
        <ul className="flex items-center gap-0.5">
          <li>
            <Link href="/" className={NAV_LINK}>
              Beranda
            </Link>
          </li>
          <li>
            <Link href="/tentang-data" className={NAV_LINK}>
              Tentang Data
            </Link>
          </li>
          <li>
            <Link href="/usul" className={NAV_LINK}>
              Usulkan
            </Link>
          </li>
          {isLoggedIn ? (
            <>
              <li>
                <Link href="/rencana" className={NAV_LINK}>
                  Rencana
                </Link>
              </li>
              {isAdminUser && (
                <li>
                  <Link href="/admin/usulan" className={NAV_LINK}>
                    Tinjau
                  </Link>
                </li>
              )}
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

      {/* Pengatur tema (selalu terlihat di desktop dan mobile) */}
      <ThemeToggle />

      {/* Tombol Burger Menu Mobile */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
        aria-label={isOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
        className="flex size-11 items-center justify-center rounded-lg border border-hairline/70 bg-surface-soft/60 text-ink transition-colors hover:bg-surface-soft active:bg-surface-card md:hidden"
      >
        <div className="relative flex size-5 flex-col items-center justify-center gap-1.5" aria-hidden="true">
          <span
            className={`h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ease-in-out ${
              isOpen ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`h-0.5 w-5 rounded-full bg-current transition-opacity duration-200 ease-in-out ${
              isOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ease-in-out ${
              isOpen ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </div>
      </button>

      {/* Menu Drawer Mobile */}
      {isOpen && (
        <>
          {/* Latar Belakang Redup (Backdrop) */}
          <div
            onClick={closeMenu}
            className="fixed inset-0 top-14 z-40 bg-black/40 backdrop-blur-xs md:hidden"
            aria-hidden="true"
          />

          {/* Panel Menu Mobile */}
          <div
            id="mobile-nav-menu"
            ref={menuRef}
            className="fixed inset-x-0 top-14 z-50 max-h-[calc(100dvh-56px)] overflow-y-auto border-b border-hairline bg-canvas/98 px-4 py-5 shadow-2xl backdrop-blur-xl md:hidden dark:bg-canvas/98"
          >
            <nav aria-label="Navigasi utama mobile">
              <ul className="flex flex-col gap-1">
                <li>
                  <Link
                    href="/"
                    onClick={closeMenu}
                    className={`${MOBILE_LINK} ${pathname === "/" ? "bg-surface-soft text-ink font-semibold" : ""}`}
                  >
                    <span>Beranda</span>
                    <span className="text-xs text-muted" aria-hidden="true">Peta & 365 Wisata</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/tentang-data"
                    onClick={closeMenu}
                    className={`${MOBILE_LINK} ${
                      pathname === "/tentang-data" ? "bg-surface-soft text-ink font-semibold" : ""
                    }`}
                  >
                    <span>Tentang Data & Skor</span>
                    <span className="text-xs text-muted" aria-hidden="true">Metodologi BMKG</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/usul"
                    onClick={closeMenu}
                    className={`${MOBILE_LINK} ${pathname === "/usul" ? "bg-surface-soft text-ink font-semibold" : ""}`}
                  >
                    <span>Usulkan Destinasi</span>
                    <span className="text-xs text-muted" aria-hidden="true">Pengelola Wisata</span>
                  </Link>
                </li>

                <li className="my-2 border-t border-hairline" role="separator" />

                {isLoggedIn ? (
                  <>
                    <li>
                      <Link
                        href="/rencana"
                        onClick={closeMenu}
                        className={`${MOBILE_LINK} ${
                          pathname === "/rencana" ? "bg-surface-soft text-ink font-semibold" : ""
                        }`}
                      >
                        <span>Rencana Kunjungan</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-semibold">
                          Tersimpan
                        </span>
                      </Link>
                    </li>
                    {isAdminUser && (
                      <li>
                        <Link
                          href="/admin/usulan"
                          onClick={closeMenu}
                          className={`${MOBILE_LINK} ${
                            pathname.startsWith("/admin") ? "bg-surface-soft text-ink font-semibold" : ""
                          }`}
                        >
                          <span>Tinjau Usulan</span>
                          <span className="rounded-full bg-surface-dark px-2 py-0.5 text-xs text-on-dark font-medium">
                            Admin
                          </span>
                        </Link>
                      </li>
                    )}
                    <li>
                      <form action={signOutAction} className="w-full">
                        <button
                          type="submit"
                          onClick={closeMenu}
                          className={`${MOBILE_LINK} text-red-600 hover:text-red-700 dark:text-red-400`}
                        >
                          <span>Keluar dari Akun</span>
                          <span aria-hidden="true">→</span>
                        </button>
                      </form>
                    </li>
                  </>
                ) : (
                  <li>
                    <Link
                      href="/masuk"
                      onClick={closeMenu}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-semibold text-on-primary transition-opacity hover:opacity-90 active:opacity-95"
                    >
                      <span>Masuk atau Daftar</span>
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
