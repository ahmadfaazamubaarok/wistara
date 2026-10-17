"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ScoreChip } from "@/components/score-chip";
import { CATEGORY_LABEL, type DestCategory } from "@/lib/categories";
import { getDestinationEnrichment } from "@/lib/destination-enrichment";
import type { ItineraryPlan } from "@/lib/ai/itinerary-planner";

type DestinationRecommendation = {
  slug: string;
  name: string;
  category: DestCategory;
  kabupaten: string;
  score: number | null;
  weatherDesc: string | null;
  temp: number | null;
  reason?: string;
  reasons?: string[];
  ticketPrice?: string;
  slotLabel?: string;
  openHours?: string;
  hoursVerified?: boolean;
  details?: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  destinations?: DestinationRecommendation[];
  itinerary?: ItineraryPlan | null;
  canSave?: boolean;
  notices?: string[];
  suggestions?: string[];
  focus?: string[];
  timestamp: string;
};

const SUGGESTED_PROMPTS = [
  { label: "Bikinin rencana 1 hari besok", query: "Bikinin rencana jalan-jalan 1 hari untuk besok dong" },
  { label: "Wisata sejuk saat terik siang", query: "Rekomendasi wisata sejuk saat siang hari terik" },
  { label: "Sore sunset di pantai selatan", query: "Sore ini jam 16.00 mau sunsetan di pantai yang cerah" },
  { label: "Alternatif indoor kalau hujan", query: "Kalau hujan lebat di Jogja enaknya ke destinasi mana?" },
  { label: "Tiket & info Museum Sonobudoyo", query: "Berapa harga tiket masuk dan fasilitas Museum Sonobudoyo?" },
  { label: "Komparasi Prambanan vs Ratu Boko", query: "Lebih recommended Candi Prambanan atau Candi Ratu Boko sore nanti?" },
] as const;

const CHAT_STORAGE_KEY = "wistara_chat_messages";
const SAVED_PLANS_KEY = "wistara_saved_plans_map";

function formatCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}.${now.getMinutes().toString().padStart(2, "0")}`;
}

type Props = {
  onSelectDestination?: (slug: string) => void;
  onClose?: () => void;
};

export function WistaraAiPanel({ onSelectDestination, onClose }: Props) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [savingPlanTitle, setSavingPlanTitle] = useState<string | null>(null);
  const [savedPlanMap, setSavedPlanMap] = useState<Record<string, string>>({}); // title -> tripId
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageSeq = useRef(0);
  const isInitialMount = useRef(true);
  const router = useRouter();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Muat riwayat chat & rencana tersimpan dari sessionStorage saat pertama kali dibuka di sesi browser
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem(CHAT_STORAGE_KEY);
      let initialMsgs: ChatMessage[] = [];
      if (stored) {
        const parsed: ChatMessage[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialMsgs = parsed;
        }
      }

      // Cek apakah ada rencana tersimpan sementara dari tamu yang baru saja login
      const pendingRaw = sessionStorage.getItem("wistara_pending_itinerary");
      if (pendingRaw) {
        const pending: ItineraryPlan = JSON.parse(pendingRaw);
        const restoredMsg: ChatMessage = {
          id: `ai-restored-${Date.now()}`,
          role: "assistant",
          content: `Selamat datang kembali! Rencana kunjungan "${pending.title}" yang Anda susun sebelumnya telah kami pulihkan. Anda dapat langsung menyimpannya ke akun sekarang:`,
          itinerary: pending,
          canSave: true,
          timestamp: formatCurrentTime(),
        };
        initialMsgs.push(restoredMsg);
        sessionStorage.removeItem("wistara_pending_itinerary");
      }

      if (initialMsgs.length > 0) {
        // Membaca sessionStorage hanya bisa setelah mount; setState di sini disengaja.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages(initialMsgs);
        messageSeq.current = initialMsgs.length;
      }

      const storedPlans = sessionStorage.getItem(SAVED_PLANS_KEY);
      if (storedPlans) {
        setSavedPlanMap(JSON.parse(storedPlans));
      }
    } catch {
      // abaikan bila format rusak
    }
  }, []);

  // Simpan riwayat chat ke sessionStorage tiap kali pesan berubah
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    try {
      if (messages.length > 0) {
        sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
      } else {
        sessionStorage.removeItem(CHAT_STORAGE_KEY);
      }
    } catch {
      // abaikan jika kuota penyimpanan penuh
    }
  }, [messages]);

  // Simpan peta rencana tersimpan ke sessionStorage
  useEffect(() => {
    try {
      if (Object.keys(savedPlanMap).length > 0) {
        sessionStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(savedPlanMap));
      }
    } catch { }
  }, [savedPlanMap]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${++messageSeq.current}`,
      role: "user",
      content: query,
      timestamp: formatCurrentTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const lastFocus = [...messages].reverse().find((m) => m.role === "assistant" && m.focus && m.focus.length > 0)?.focus ?? [];
      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
      const res = await fetch("/api/v1/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, history, focus: lastFocus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const errorText =
          errData?.message ||
          (res.status === 429
            ? "Batas pertanyaan per jam telah tercapai. Silakan tunggu beberapa saat lagi."
            : "Koneksi ke asisten sedang mengalami gangguan singkat. Anda tetap dapat menjelajahi destinasi dan prakiraan cuaca 3-jaman langsung melalui peta di samping.");
        
        const errorMsg: ChatMessage = {
          id: `ai-${++messageSeq.current}`,
          role: "assistant",
          content: errorText,
          timestamp: formatCurrentTime(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: `ai-${++messageSeq.current}`,
        role: "assistant",
        content: data.reply,
        destinations: data.cards,
        itinerary: data.itinerary,
        canSave: data.canSave,
        notices: data.notices,
        suggestions: data.suggestions,
        focus: data.focus,
        timestamp: formatCurrentTime(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      // Fallback ramah jika koneksi jaringan klien terputus total
      const fallbackMsg: ChatMessage = {
        id: `ai-${++messageSeq.current}`,
        role: "assistant",
        content: "Koneksi ke asisten sedang mengalami gangguan singkat. Anda tetap dapat menjelajahi destinasi dan prakiraan cuaca 3-jaman langsung melalui peta di samping.",
        timestamp: formatCurrentTime(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveItinerary = async (itinerary: ItineraryPlan) => {
    setSavingPlanTitle(itinerary.title);
    try {
      const res = await fetch("/api/v1/assistant/save-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: itinerary.title,
          dayKey: itinerary.dayKey,
          items: itinerary.slots.map((s) => ({
            slug: s.destination.slug,
            part: s.part,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal menyimpan rencana");
      }

      const data = await res.json();
      setSavedPlanMap((prev) => ({ ...prev, [itinerary.title]: data.tripId }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan rencana";
      alert(msg);
    } finally {
      setSavingPlanTitle(null);
    }
  };

  const handleGuestRedirect = (itinerary: ItineraryPlan) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("wistara_pending_itinerary", JSON.stringify(itinerary));
      router.push("/masuk?next=/");
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
      sessionStorage.removeItem(SAVED_PLANS_KEY);
    } catch { }
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-canvas">
      {/* Header Panel Wistara AI (Gaya Google Maps) */}
      <header className="flex items-center justify-between border-b border-hairline px-4 py-3 bg-surface-card">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              <path d="M20 3v4" />
              <path d="M22 5h-4" />
            </svg>
          </span>
          <div>
            <h2 className="font-sans text-[14px] font-bold text-ink leading-tight">Tanya Wistara AI</h2>
            <p className="text-[11px] text-muted leading-tight">Didukung data cuaca BMKG & scoring outdoor</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={resetChat}
              title="Bersihkan percakapan"
              aria-label="Bersihkan percakapan"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-ink transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Tutup panel AI"
              aria-label="Tutup panel AI"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-ink transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Area Chat / Konten Percakapan */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 space-y-4">
        {/* State Awal: Rekomendasi Pertanyaan Cepat */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4" />
                <path d="m4.93 4.93 2.83 2.83" />
                <path d="M20 12h-4" />
                <path d="m16.24 7.76 2.83-2.83" />
                <path d="M12 18v4" />
                <path d="m4.93 19.07 2.83-2.83" />
                <path d="m16.24 16.24 2.83 2.83" />
              </svg>
            </div>
            <h3 className="font-sans text-[15px] font-bold text-ink">Ada rencana jalan-jalan ke mana?</h3>
            <p className="mt-1 max-w-[280px] text-xs text-muted leading-relaxed">
              Tanyakan waktu terbaik, rekomendasi tempat saat cuaca panas/hujan, atau minta susunkan rencana 1 hari.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-1.5 w-full">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => handleSend(prompt.query)}
                  className="rounded-full border border-hairline bg-surface-card px-3 py-1.5 text-[11.5px] font-medium text-body hover:border-primary/50 hover:bg-surface-soft hover:text-ink transition-all active:scale-95"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Daftar Balon Pesan */}
        {messages.length > 0 && (
          <div className="flex flex-col gap-3.5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[94%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-2xs ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-br-xs"
                      : "bg-surface-card border border-hairline text-body rounded-bl-xs"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-line">{msg.content}</p>
                  ) : (
                    <div className="text-[13px] leading-relaxed text-body">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          code: ({ children }) => (
                            <code className="rounded bg-surface-soft px-1.5 py-0.5 font-mono text-[11.5px] text-primary">
                              {children}
                            </code>
                          ),
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="font-medium text-primary underline hover:text-primary/80"
                            >
                              {children}
                            </a>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* TAMPILAN RENCANA PERJALANAN (ITINERARY 3 SLOT) */}
                  {msg.itinerary && (
                    <div className="mt-3.5 rounded-xl border border-primary/20 bg-canvas p-3.5 shadow-xs">
                      <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                        <div>
                          <h4 className="font-sans text-[13.5px] font-bold text-ink leading-tight">
                            {msg.itinerary.title}
                          </h4>
                          <span className="text-[11px] text-muted">{msg.itinerary.dayLabel} · {msg.itinerary.slots.length} destinasi</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted">Rata-rata:</span>
                          <ScoreChip score={msg.itinerary.averageScore} size="sm" />
                        </div>
                      </div>

                      {/* Timeline 3 Slot */}
                      <div className="mt-3 space-y-3">
                        {msg.itinerary.slots.map((slotItem) => (
                          <div key={`${slotItem.part}-${slotItem.destination.slug}`} className="relative pl-4 border-l-2 border-primary/30">
                            <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                                {slotItem.timeLabel}
                              </span>
                              <ScoreChip score={slotItem.destination.score} size="sm" />
                            </div>

                            <h5 className="font-sans text-[13px] font-bold text-ink mt-0.5">
                              <Link
                                href={`/destinasi/${slotItem.destination.slug}`}
                                className="no-underline hover:underline"
                              >
                                {slotItem.destination.name}
                              </Link>
                            </h5>

                            <p className="text-[11px] text-muted">
                              {CATEGORY_LABEL[slotItem.destination.category]} · {slotItem.destination.kabupaten} ·{" "}
                              <span className="text-ink font-medium">{slotItem.destination.temp}°C</span> ({slotItem.destination.weatherDesc})
                            </p>

                            <p className="mt-1 text-[11.5px] text-body italic leading-normal">
                              &ldquo;{slotItem.notes}&rdquo;
                            </p>

                            <div className="mt-2 flex items-center gap-2">
                              {onSelectDestination && (
                                <button
                                  type="button"
                                  onClick={() => onSelectDestination(slotItem.destination.slug)}
                                  className="inline-flex min-h-6 items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                                >
                                  Sorot di peta
                                </button>
                              )}
                              <Link
                                href={`/destinasi/${slotItem.destination.slug}`}
                                className="inline-flex min-h-6 items-center rounded-md bg-surface-dark px-2 py-0.5 text-[11px] font-semibold text-on-dark no-underline hover:opacity-90 transition-opacity"
                              >
                                Detail
                              </Link>
                            </div>

                            {/* Indikator Perpindahan Transit */}
                            {slotItem.transitFromPrevious && (
                              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-surface-soft px-2 py-1 text-[10.5px] text-muted">
                                <span className="font-medium text-ink">Transit:</span>
                                <span>
                                  ~{slotItem.transitFromPrevious.estimatedMinutes} menit ({slotItem.transitFromPrevious.distanceKm} km)
                                </span>
                                {slotItem.transitFromPrevious.isFar && (
                                  <span className="text-amber-600 font-semibold">(Cukup jauh)</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Notifikasi / Peringatan Rute */}
                      {msg.itinerary.notices.length > 0 && (
                        <div className="mt-3 rounded-md bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                          {msg.itinerary.notices.map((n, i) => (
                            <p key={i}>{n}</p>
                          ))}
                        </div>
                      )}

                      {/* Tombol Simpan Rencana (Login vs Tamu) */}
                      <div className="mt-3.5 pt-3 border-t border-hairline">
                        {savedPlanMap[msg.itinerary.title] ? (
                          <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-800 dark:text-emerald-200">
                            <span className="text-xs font-semibold">Tersimpan di Rencana Anda</span>
                            <Link
                              href="/rencana"
                              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 underline"
                            >
                              Buka Rencana ↗
                            </Link>
                          </div>
                        ) : msg.canSave ? (
                          <button
                            type="button"
                            disabled={savingPlanTitle === msg.itinerary.title}
                            onClick={() => handleSaveItinerary(msg.itinerary!)}
                            className="flex w-full min-h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition-opacity disabled:opacity-50"
                          >
                            {savingPlanTitle === msg.itinerary.title ? (
                              <span>Menyimpan ke akun...</span>
                            ) : (
                              <span>Simpan ke Rencana Saya</span>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleGuestRedirect(msg.itinerary!)}
                            className="flex w-full min-h-9 items-center justify-center gap-1.5 rounded-lg bg-surface-dark px-3 py-1.5 text-xs font-bold text-on-dark hover:opacity-90 transition-opacity"
                          >
                            <span>Masuk / Daftar untuk Simpan Rencana</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* KARTU DESTINASI TERKAIT (Jika bukan itinerary) */}
                  {!msg.itinerary && msg.destinations && msg.destinations.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2.5">
                      {msg.destinations.map((dest) => {
                        const enrichment = getDestinationEnrichment(dest.slug);
                        const reasonText = dest.reason || (dest.reasons && dest.reasons[0]) || "";
                        return (
                          <div
                            key={dest.slug}
                            className="rounded-xl border border-hairline bg-canvas p-3 shadow-xs hover:border-primary/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-sans text-[13.5px] font-bold text-ink">
                                  <Link
                                    href={`/destinasi/${dest.slug}`}
                                    className="no-underline hover:underline focus:underline"
                                  >
                                    {dest.name}
                                  </Link>
                                </h4>
                                <p className="text-[11px] text-muted">
                                  {CATEGORY_LABEL[dest.category]} · {dest.kabupaten}
                                  {dest.ticketPrice
                                    ? ` · ${dest.ticketPrice}`
                                    : enrichment?.ticketPrice?.domestic
                                      ? ` · ${enrichment.ticketPrice.domestic}`
                                      : ""}
                                </p>
                              </div>
                              <ScoreChip score={dest.score} size="sm" />
                            </div>

                            {dest.temp !== null && (
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                                <span className="font-semibold text-ink">{dest.temp}°C</span>
                                <span>·</span>
                                <span>{dest.weatherDesc}</span>
                              </div>
                            )}

                            {dest.slotLabel && <p className="mt-1 text-[11px] text-muted">{dest.slotLabel}</p>}
                            {dest.openHours && (
                              <p className="mt-1 text-[11px] text-muted">
                                Jam buka: {dest.openHours}
                                {dest.hoursVerified === false ? " (belum diverifikasi)" : ""}
                              </p>
                            )}
                            {dest.details?.map((line) => (
                              <p key={line} className="mt-1 text-[11px] text-muted">
                                {line}
                              </p>
                            ))}

                            {reasonText && (
                              <p className="mt-1.5 text-[11.5px] text-body italic leading-normal border-t border-hairline pt-1.5">
                                &ldquo;{reasonText}&rdquo;
                              </p>
                            )}

                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              {onSelectDestination && (
                                <button
                                  type="button"
                                  onClick={() => onSelectDestination(dest.slug)}
                                  className="inline-flex min-h-7 items-center rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                                >
                                  Sorot di peta
                                </button>
                              )}
                              <Link
                                href={`/destinasi/${dest.slug}`}
                                className="inline-flex min-h-7 items-center rounded-md bg-surface-dark px-2.5 py-1 text-[11px] font-semibold text-on-dark no-underline hover:no-underline hover:opacity-90 transition-opacity"
                              >
                                Detail
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Catatan dari mesin (mis. data tidak lengkap, harga bisa berubah) */}
                  {!msg.itinerary && msg.notices && msg.notices.length > 0 && (
                    <ul className="mt-2.5 space-y-1 border-t border-hairline pt-2 text-[11px] leading-snug text-muted">
                      {msg.notices.map((note) => (
                        <li key={note}>• {note}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <span className="mt-1 px-1 text-[10px] text-muted">{msg.timestamp}</span>

                {/* Pertanyaan lanjutan yang disarankan, hanya untuk jawaban terakhir */}
                {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && msg.id === messages[messages.length - 1]?.id && !isLoading && (
                  <div className="mt-1.5 flex max-w-[94%] flex-wrap gap-1.5">
                    {msg.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSend(suggestion)}
                        className="rounded-full border border-hairline bg-surface-card px-3 py-1.5 text-[11.5px] font-medium text-body hover:border-primary/50 hover:bg-surface-soft hover:text-ink transition-all active:scale-95"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Indikator Mengetik */}
            {isLoading && (
              <div className="flex items-center gap-1.5 rounded-2xl bg-surface-card border border-hairline px-3.5 py-2 text-xs text-muted w-fit">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 text-[11px]">Menganalisis cuaca BMKG & menyusun rekomendasi...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar di Bagian Bawah Panel Kiri */}
      <footer className="border-t border-hairline bg-surface-card p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan tentang wisata, cuaca, atau minta rencana..."
            className="min-h-11 flex-1 rounded-full border border-border-input bg-canvas px-4 text-[13px] text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Kirim pertanyaan ke Wistara AI"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity disabled:opacity-40 hover:opacity-90 active:scale-95"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
