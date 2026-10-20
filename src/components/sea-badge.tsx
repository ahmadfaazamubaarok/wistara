import type { SeaStatus } from "@/lib/marine/sea-status";
import { SEA_STATUS_HINT, seaAriaLabel, seaBadgeFullText } from "@/lib/marine/sea-labels";

// Badge status laut. Sengaja dibedakan dari chip skor cuaca lewat BENTUK
// (persegi radius 6px, bukan pill), IKON (ombak), dan teks. Warna memakai
// token --color-sea-* di globals.css; tidak ada varian hijau.

export const SEA_STATUS_CLASSES: Record<SeaStatus, string> = {
  perhatian: "bg-sea-info-bg text-sea-info-text",
  waspada: "bg-sea-caution-bg text-sea-caution-text",
  bahaya: "bg-sea-danger-bg text-sea-danger-text",
  informasi_terbatas: "bg-sea-unknown-bg text-sea-unknown-text",
};

export function WaveIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 7c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" />
      <path d="M2 13c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" />
      <path d="M2 19c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" />
    </svg>
  );
}

type Props = {
  status: SeaStatus;
  waveHeight?: number | null;
  waveCat?: string | null;
  className?: string;
  size?: "sm" | "md";
};

export function SeaBadge({ status, waveHeight, waveCat, className = "", size = "md" }: Props) {
  const text = seaBadgeFullText(status, waveCat, waveHeight);
  const sizeClasses =
    size === "sm" ? "px-1.5 py-0.5 text-[11px] gap-1" : "px-2 py-0.5 text-[12.5px] font-semibold gap-1.5";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm border border-current/35 tabular-nums ${sizeClasses} ${SEA_STATUS_CLASSES[status]} ${className}`}
      title={`${text}. ${SEA_STATUS_HINT[status]}`}
      aria-label={seaAriaLabel(status, waveCat, waveHeight)}
    >
      <WaveIcon size={size === "sm" ? 12 : 14} />
      <span>{text}</span>
    </span>
  );
}
