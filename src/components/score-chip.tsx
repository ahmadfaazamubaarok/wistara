import type { ReactNode } from "react";
import { getScoreBand, SCORE_LABEL, type ScoreBand } from "@/lib/score-band";

// Chip status skor (DESIGN-jelajahlokal.md, "Chip skor"). Status SELALU berupa
// chip berlatar muda dengan ikon + teks, tidak pernah blok solid, dan tidak
// hanya dibedakan lewat warna: tiap status punya bentuk ikon berbeda.

const BAND_CLASS: Record<ScoreBand, string> = {
  good: "bg-score-good-bg text-score-good-text",
  mid: "bg-score-mid-bg text-score-mid-text",
  bad: "bg-score-bad-bg text-score-bad-text",
  closed: "bg-score-closed-bg text-score-closed-text",
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const BAND_ICON: Record<ScoreBand, ReactNode> = {
  // lingkaran centang
  good: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  ),
  // setengah lingkaran
  mid: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" />
    </Icon>
  ),
  // segitiga tanda seru
  bad: (
    <Icon>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  ),
  // gembok
  closed: (
    <Icon>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  ),
};

type ScoreChipProps = {
  /** Skor 0-100, atau `null` untuk slot di luar jam buka. */
  score: number | null;
  /** Hanya ikon + angka (untuk sel slot yang sempit). Label tetap terbaca pembaca layar. */
  compact?: boolean;
};

export function ScoreChip({ score, compact = false }: ScoreChipProps) {
  const band = getScoreBand(score);
  const label = SCORE_LABEL[band];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-sm font-medium ${BAND_CLASS[band]}`}
    >
      {BAND_ICON[band]}
      {score !== null && <span className="font-bold tabular-nums">{score}</span>}
      <span className={compact ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}
