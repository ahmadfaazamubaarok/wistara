import type { ReactNode } from "react";
import { MiscIcon } from "./icons";

// Gaya tombol dari DESIGN-jelajahlokal.md: tinggi minimal 44px, soga hanya untuk
// satu aksi utama per layar, tombol sekunder berbingkai border-input.
const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-semibold leading-none no-underline transition-colors";

export const buttonClass = {
  primary: `${BUTTON_BASE} bg-primary text-on-primary hover:bg-primary-active active:bg-primary-active`,
  secondary: `${BUTTON_BASE} border border-border-input bg-canvas text-ink hover:bg-surface-soft`,
} as const;

type BannerProps = { kind: "stale" | "alert"; children: ReactNode };

/** Banner status: amber untuk data lama, merah untuk peringatan dini. Tidak bisa ditutup. */
export function StatusBanner({ kind, children }: BannerProps) {
  const style =
    kind === "stale"
      ? "bg-banner-stale-bg text-banner-stale-text"
      : "bg-banner-alert-bg text-banner-alert-text";
  return (
    <div role="status" className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm font-medium ${style}`}>
      <span className="mt-0.5 shrink-0">
        <MiscIcon name={kind === "stale" ? "clock" : "cloudLightning"} size={18} />
      </span>
      <div>{children}</div>
    </div>
  );
}
