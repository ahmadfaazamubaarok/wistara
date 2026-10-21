"use client";

import { useEffect, useRef, useState } from "react";

export type TocItem = {
  id: string;
  label: string;
  number?: string;
};

type Props = {
  items: TocItem[];
};

export function TableOfContents({ items }: Props) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const isClickScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mobileNavRef = useRef<HTMLOListElement | null>(null);

  // Deteksi seksi aktif saat scroll manual dengan garis pandang (reading line)
  useEffect(() => {
    const handleScroll = () => {
      // Abaikan jika sedang dalam proses smooth scroll akibat klik tautan
      if (isClickScrollingRef.current) return;

      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // 1. Jika pengguna sudah berada di dekat dasar halaman, aktifkan item terakhir
      if (scrollY + windowHeight >= docHeight - 80) {
        setActiveId(items[items.length - 1].id);
        return;
      }

      // 2. Ambang batas jarak dari puncak viewport ke kepala seksi:
      // Di desktop: 120px; di ponsel (ada header 57px + mobile TOC 45px): 150px
      const isDesktop = window.innerWidth >= 1024;
      const threshold = isDesktop ? 120 : 150;

      let currentId = items[0]?.id ?? "";
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Seksi yang puncak elemennya sudah mencapai atau melewati garis pandang
          if (rect.top <= threshold) {
            currentId = item.id;
          }
        }
      }
      setActiveId(currentId);
    };

    // Jalankan sekali saat inisialisasi agar status langsung sinkron
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [items]);

  // Otomatis geser bilah navigasi horizontal ponsel agar pil aktif selalu di tengah
  useEffect(() => {
    if (!mobileNavRef.current) return;
    const activePill = mobileNavRef.current.querySelector<HTMLElement>(
      `[data-toc-id="${activeId}"]`,
    );
    if (activePill) {
      activePill.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeId]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;

    // Kunci scroll listener agar tidak menginterupsi animasi smooth scroll
    isClickScrollingRef.current = true;
    setActiveId(id);
    window.history.pushState(null, "", `#${id}`);

    // Hitung posisi gulir presisi dengan memperhitungkan sticky header & navbar
    const isDesktop = window.innerWidth >= 1024;
    const topOffset = isDesktop ? 80 : 120;
    const targetY = el.getBoundingClientRect().top + window.scrollY - topOffset;

    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: "smooth",
    });

    // Buka kembali kunci listener setelah animasi smooth scroll selesai (~750ms)
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 750);
  };

  return (
    <>
      {/* Sidebar Desktop Sticky (Kiri) */}
      <nav aria-label="Daftar isi" className="sticky top-24 hidden self-start lg:block">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Daftar Isi
        </p>
        <ol className="space-y-0.5 border-l border-hairline">
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  aria-current={isActive ? "location" : undefined}
                  className={`-ml-px flex items-baseline gap-2 border-l-2 py-1.5 pl-4 text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 ${
                    isActive
                      ? "border-primary font-semibold text-ink"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {item.number && (
                    <span
                      className={`text-[12px] font-mono tabular-nums ${
                        isActive ? "text-link font-semibold" : "text-muted"
                      }`}
                      aria-hidden="true"
                    >
                      {item.number}
                    </span>
                  )}
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Bilah Navigasi Horizontal Mobile Sticky */}
      <nav
        aria-label="Daftar isi ponsel"
        className="sticky top-14 z-20 -mx-4 border-b border-hairline bg-canvas/92 px-4 py-2 backdrop-blur lg:hidden"
      >
        <ol
          ref={mobileNavRef}
          className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`#${item.id}`}
                  data-toc-id={item.id}
                  onClick={(e) => handleClick(e, item.id)}
                  aria-current={isActive ? "location" : undefined}
                  className={`block rounded-pill px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 ${
                    isActive
                      ? "bg-surface-dark text-on-dark font-medium shadow-xs"
                      : "border border-border-input bg-canvas text-body hover:bg-surface-soft hover:text-ink"
                  }`}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
