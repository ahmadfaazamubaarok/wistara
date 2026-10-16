"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("wistara-theme-change", callback);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "class") {
        callback();
        break;
      }
    }
  });
  if (typeof document !== "undefined") {
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }

  return () => {
    window.removeEventListener("wistara-theme-change", callback);
    observer.disconnect();
  };
}

function getSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === "dark";
  const label = isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap";

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    try {
      localStorage.setItem("wistara-theme", nextTheme);
    } catch {
      // LocalStorage tidak tersedia di lingkungan privat tertentu
    }

    window.dispatchEvent(
      new CustomEvent("wistara-theme-change", { detail: { theme: nextTheme } })
    );
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-soft text-body transition-colors hover:bg-surface-card hover:text-ink focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
    >
      {isDark ? (
        // Ikon Matahari (untuk beralih ke mode terang)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Ikon Bulan Sabit (untuk beralih ke mode gelap)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}
