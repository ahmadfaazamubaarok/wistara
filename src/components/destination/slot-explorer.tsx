"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { CategoryIcon, MiscIcon, WeatherIcon } from "@/components/icons";
import { ScoreChip } from "@/components/score-chip";
import type { SlotDto } from "@/lib/api/dto";
import { CATEGORY_LABEL } from "@/lib/categories";
import type { Alternative } from "@/lib/forecast/alternatives";
import { formatDayKey, formatDistance, relativeDayName, slotHour } from "@/lib/format";

type Props = {
  dayKeys: string[];
  slots: SlotDto[];
  /** Kunci = validAt slot terpicu (skor < 50 dan penalti terbesar hujan). */
  alternatives: Record<string, Alternative[]>;
  /** Slot lain terbaik di destinasi ini, untuk slot terpicu yang tanpa alternatif. */
  otherSlots: Record<string, SlotDto | null>;
  initialValidAt: string | null;
};

const dayOf = (slot: SlotDto) => slot.localTime.slice(0, 10);
const isTriggered = (slot: SlotDto) => slot.score !== null && slot.score < 50 && slot.dominantPenalty === "rain";

function bestOf(slots: SlotDto[]): SlotDto | undefined {
  let best: SlotDto | undefined;
  for (const slot of slots) {
    if (slot.score !== null && (!best || slot.score > (best.score as number))) best = slot;
  }
  return best ?? slots[0];
}

export function SlotExplorer({ dayKeys, slots, alternatives, otherSlots, initialValidAt }: Props) {
  const [selectedValidAt, setSelectedValidAt] = useState<string | null>(initialValidAt);
  const optionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const selected = slots.find((slot) => slot.validAt === selectedValidAt) ?? null;
  const activeDay = selected ? dayOf(selected) : (dayKeys.find((day) => slots.some((s) => dayOf(s) === day)) ?? dayKeys[0]);
  const daySlots = slots.filter((slot) => dayOf(slot) === activeDay);

  const chooseDay = (day: string) => {
    const best = bestOf(slots.filter((slot) => dayOf(slot) === day));
    setSelectedValidAt(best?.validAt ?? null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = daySlots.findIndex((slot) => slot.validAt === selectedValidAt);
    let next = index;
    if (event.key === "ArrowRight") next = Math.min(daySlots.length - 1, index + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = daySlots.length - 1;
    else return;
    event.preventDefault();
    const target = daySlots[next];
    if (!target) return;
    setSelectedValidAt(target.validAt);
    optionRefs.current.get(target.validAt)?.focus();
  };

  const hasAnySlot = slots.length > 0;
  const triggered = selected ? isTriggered(selected) : false;
  const picks = selected ? (alternatives[selected.validAt] ?? []) : [];
  const other = selected ? (otherSlots[selected.validAt] ?? null) : null;

  if (!hasAnySlot) {
    return (
      <p className="rounded-lg bg-surface-card p-4 text-body">
        Belum ada prakiraan untuk 3 hari ke depan. Coba lagi beberapa saat lagi.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Pilih hari" className="flex gap-2">
        {dayKeys.map((day, index) => {
          const has = slots.some((slot) => dayOf(slot) === day);
          return (
            <button
              key={day}
              role="tab"
              type="button"
              aria-selected={activeDay === day}
              disabled={!has}
              onClick={() => chooseDay(day)}
              className={`min-h-11 flex-1 rounded-md border px-2 py-1 text-sm font-semibold leading-tight disabled:cursor-not-allowed disabled:border-hairline disabled:bg-primary-disabled disabled:text-muted ${
                activeDay === day
                  ? "border-surface-dark bg-surface-dark text-on-dark"
                  : "border-border-input bg-canvas text-ink hover:bg-surface-soft"
              }`}
            >
              <span className="block">{relativeDayName(index)}</span>
              <span className="block text-[12px] font-normal opacity-90">{has ? formatDayKey(day) : "Belum ada data"}</span>
            </button>
          );
        })}
      </div>

      <div
        role="listbox"
        aria-label="Slot waktu 3 jam (WIB). Gunakan tombol panah untuk berpindah."
        onKeyDown={onKeyDown}
        className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
      >
        {daySlots.map((slot) => {
          const isSelected = slot.validAt === selectedValidAt;
          return (
            <button
              key={slot.validAt}
              ref={(node) => {
                if (node) optionRefs.current.set(slot.validAt, node);
                else optionRefs.current.delete(slot.validAt);
              }}
              role="option"
              type="button"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelectedValidAt(slot.validAt)}
              className={`flex w-[88px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-lg bg-canvas px-2 py-3 ${
                isSelected ? "border-2 border-surface-dark" : "border border-hairline hover:bg-surface-soft"
              }`}
            >
              <span className="text-sm font-semibold tabular-nums text-ink">{slotHour(slot.localTime)}</span>
              <span className="text-body">
                <WeatherIcon description={slot.weatherDesc} size={24} />
              </span>
              <span className="sr-only">{slot.weatherDesc ?? "Cuaca tidak diketahui"}</span>
              <span className="text-sm tabular-nums text-body">{slot.t === null ? "–" : `${Math.round(slot.t)}°`}</span>
              <ScoreChip score={slot.score} compact />
            </button>
          );
        })}
      </div>

      {selected && (
        <section aria-live="polite" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-sans text-[17px] lg:text-[18px]">
              {relativeDayName(dayKeys.indexOf(dayOf(selected)))}, pukul {slotHour(selected.localTime)} WIB
            </h3>
            <ScoreChip score={selected.score} />
          </div>

          {selected.isOpen ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[15px] sm:grid-cols-4">
              <div>
                <dt className="text-[13px] text-muted">Cuaca</dt>
                <dd className="text-ink">{selected.weatherDesc ?? "–"}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Suhu</dt>
                <dd className="tabular-nums text-ink">{selected.t === null ? "–" : `${selected.t} °C`}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Angin</dt>
                <dd className="tabular-nums text-ink">{selected.ws === null ? "–" : `${selected.ws} km/jam`}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Kelembapan</dt>
                <dd className="tabular-nums text-ink">{selected.hu === null ? "–" : `${selected.hu}%`}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-body">Slot ini di luar jam buka, jadi tidak dinilai.</p>
          )}

          {selected.isOpen && selected.band !== "good" && (
            <div>
              <h4 className="font-sans text-[15px] font-semibold text-ink">
                Kenapa pukul {slotHour(selected.localTime)} {selected.label.toLowerCase()}?
              </h4>
              {selected.reasons.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-body">
                  {selected.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-body">Tidak ada satu faktor cuaca yang dominan; beberapa faktor kecil saling menambah.</p>
              )}
            </div>
          )}
          {selected.isOpen && selected.band === "good" && (
            <p className="text-body">
              {selected.reasons.length === 0
                ? "Tidak ada hambatan cuaca berarti pada slot ini."
                : `Sedikit mengurangi skor: ${selected.reasons.join("; ")}.`}
            </p>
          )}

          {triggered && (
            <aside
              aria-label="Alternatif saat hujan"
              className="rounded-lg border-l-4 border-surface-dark bg-surface-card p-4"
            >
              <h4 className="font-sans text-[17px] font-semibold text-ink">Kalau hujan, coba ini</h4>
              {picks.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-3">
                  {picks.map((alt) => (
                    <li key={alt.slug} className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/destinasi/${alt.slug}`} className="font-semibold text-ink">
                          {alt.name}
                        </Link>
                        <p className="flex items-center gap-1 text-[13px] text-muted">
                          <CategoryIcon category={alt.category} size={14} />
                          {CATEGORY_LABEL[alt.category]} · {formatDistance(alt.distanceM)} dari sini
                        </p>
                      </div>
                      <ScoreChip score={alt.score} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 flex flex-col gap-3 text-body">
                  <p>Belum ada destinasi indoor dalam 15 km yang buka dan cocok pada jam ini.</p>
                  {other && (
                    <button
                      type="button"
                      onClick={() => setSelectedValidAt(other.validAt)}
                      className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-border-input bg-canvas px-4 text-[15px] font-semibold text-ink hover:bg-surface-soft"
                    >
                      Lihat {relativeDayName(dayKeys.indexOf(dayOf(other)))} pukul {slotHour(other.localTime)} di sini
                      <span className="text-muted">(skor {other.score})</span>
                      <MiscIcon name="arrowRight" size={16} />
                    </button>
                  )}
                </div>
              )}
            </aside>
          )}
        </section>
      )}
    </div>
  );
}
