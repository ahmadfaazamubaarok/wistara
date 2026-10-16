"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ScoreChip } from "@/components/score-chip";
import { CATEGORY_LABEL, type DestCategory } from "@/lib/categories";
import { getDestinationEnrichment } from "@/lib/destination-enrichment";

type DestinationRecommendation = {
  slug: string;
  name: string;
  category: DestCategory;
  kabupaten: string;
  score: number;
  weatherDesc: string;
  temp: number;
  reason: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  destinations?: DestinationRecommendation[];
  timestamp: string;
};

const SUGGESTED_PROMPTS = [
  { label: "Wisata sejuk saat terik siang", query: "sejuk siang terik" },
  { label: "Pantai cerah sore ini", query: "pantai cerah sore" },
  { label: "Tempat ramah anak & keluarga", query: "ramah anak keluarga" },
  { label: "Alternatif indoor kalau hujan", query: "indoor kalau hujan" },
  { label: "Wisata cagar budaya bersejarah", query: "budaya candi sejarah" },
  { label: "Wisata alam dan panorama asri", query: "alam panorama pemandangan" },
] as const;

const MOCK_KNOWLEDGE: Record<string, { answer: string; destinations: DestinationRecommendation[] }> = {
  sejuk: {
    answer:
      "Untuk menghindari cuaca terik di siang hari, berikut rekomendasi destinasi di dataran tinggi Kaliurang atau kawasan hutan lindung berudara sejuk:",
    destinations: [
      {
        slug: "museum-ullen-sentalu",
        name: "Museum Ullen Sentalu",
        category: "museum",
        kabupaten: "Sleman",
        score: 94,
        weatherDesc: "Cerah Berawan",
        temp: 24,
        reason: "Terletak di lereng Merapi yang dingin, ruang pameran tertutup sejuk, dan terlindung dari terik matahari.",
      },
      {
        slug: "hutan-pinus-mangunan",
        name: "Hutan Pinus Mangunan",
        category: "alam",
        kabupaten: "Bantul",
        score: 88,
        weatherDesc: "Berawan",
        temp: 26,
        reason: "Kanopi pohon pinus rapat menciptakan bayangan teduh alami sepanjang hari.",
      },
    ],
  },
  pantai: {
    answer:
      "Berdasarkan analisis prakiraan cuaca pesisir BMKG untuk sore ini, berikut pantai di selatan DIY dengan prakiraan angin terkontrol dan langit cerah:",
    destinations: [
      {
        slug: "pantai-parangtritis",
        name: "Pantai Parangtritis",
        category: "pantai",
        kabupaten: "Bantul",
        score: 88,
        weatherDesc: "Cerah Berawan",
        temp: 28,
        reason: "Angin sepoi (12 km/jam), langit cerah berawan sangat cocok untuk pemandangan senja.",
      },
      {
        slug: "pantai-indrayanti",
        name: "Pantai Indrayanti",
        category: "pantai",
        kabupaten: "Gunungkidul",
        score: 85,
        weatherDesc: "Cerah Berawan",
        temp: 28,
        reason: "Garis pantai berpasir putih luas dengan fasilitas payung pantai dan restoran tepi laut.",
      },
    ],
  },
  keluarga: {
    answer:
      "Untuk liburan bersama keluarga dan anak-anak, tempat-tempat berikut memiliki akses jalan ramah stroller, fasilitas toilet terawat, dan tempat makan yang dekat:",
    destinations: [
      {
        slug: "desa-wisata-brayut",
        name: "Desa Wisata Brayut",
        category: "desa_wisata",
        kabupaten: "Sleman",
        score: 92,
        weatherDesc: "Cerah Berawan",
        temp: 29,
        reason: "Aktivitas edukasi seni gamelan & batik interaktif yang aman dan menyenangkan untuk anak.",
      },
      {
        slug: "museum-benteng-vredeburg",
        name: "Museum Benteng Vredeburg",
        category: "museum",
        kabupaten: "Kota Yogyakarta",
        score: 90,
        weatherDesc: "Cerah Berawan",
        temp: 30,
        reason: "Terletak di ujung Malioboro, area pejalan kaki berlantai rata, teduh, dan sarat edukasi sejarah.",
      },
    ],
  },
  hujan: {
    answer:
      "Saat diprakirakan hujan, destinasi indoor berikut adalah pilihan paling aman agar agenda wisata Anda tetap berjalan nyaman dan bebas basah:",
    destinations: [
      {
        slug: "museum-sonobudoyo",
        name: "Museum Sonobudoyo",
        category: "museum",
        kabupaten: "Kota Yogyakarta",
        score: 90,
        weatherDesc: "Hujan Ringan",
        temp: 27,
        reason: "Gedung modern ber-AC dengan koleksi artefak budaya terlengkap, sepenuhnya terlindung dari hujan.",
      },
      {
        slug: "keraton-yogyakarta",
        name: "Keraton Yogyakarta",
        category: "budaya",
        kabupaten: "Kota Yogyakarta",
        score: 86,
        weatherDesc: "Berawan Tebal",
        temp: 28,
        reason: "Area bangsal dan pendopo beratap luas melindungi wisatawan saat cuaca mendung atau gerimis.",
      },
    ],
  },
  budaya: {
    answer:
      "Berikut mahakarya cagar budaya dan sejarah di Yogyakarta dengan kondisi cuaca bersahabat untuk dijelajahi hari ini:",
    destinations: [
      {
        slug: "candi-prambanan",
        name: "Candi Prambanan",
        category: "budaya",
        kabupaten: "Sleman",
        score: 91,
        weatherDesc: "Cerah Berawan",
        temp: 29,
        reason: "Kompleks candi Hindu terbesar di Indonesia, waktu terbaik berkunjung pagi pukul 08.00–10.00.",
      },
      {
        slug: "taman-sari",
        name: "Taman Sari",
        category: "budaya",
        kabupaten: "Kota Yogyakarta",
        score: 87,
        weatherDesc: "Cerah Berawan",
        temp: 29,
        reason: "Pemandian peristirahatan keraton dengan lorong bawah tanah yang eksotis dan teduh.",
      },
    ],
  },
  default: {
    answer:
      "Saya telah memeriksa data prakiraan BMKG 3 hari ke depan untuk 20 destinasi di DIY. Berdasarkan kelayakan cuaca saat ini, berikut destinasi paling direkomendasikan:",
    destinations: [
      {
        slug: "candi-prambanan",
        name: "Candi Prambanan",
        category: "budaya",
        kabupaten: "Sleman",
        score: 91,
        weatherDesc: "Cerah Berawan",
        temp: 29,
        reason: "Skor kelayakan tinggi dengan indeks kenyamanan outdoor optimal pada pagi dan sore hari.",
      },
      {
        slug: "desa-wisata-pentingsari",
        name: "Desa Wisata Pentingsari",
        category: "desa_wisata",
        kabupaten: "Sleman",
        score: 89,
        weatherDesc: "Cerah Berawan",
        temp: 25,
        reason: "Suasana sejuk kaki Gunung Merapi dengan atraksi budaya dan perkebunan herbal lokal.",
      },
    ],
  },
};

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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageSeq = useRef(0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = (textToSend?: string) => {
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

    // Simulasi respons cepat (450ms)
    setTimeout(() => {
      const lower = query.toLowerCase();
      let match = MOCK_KNOWLEDGE.default;
      if (lower.includes("sejuk") || lower.includes("terik") || lower.includes("panas") || lower.includes("adem")) {
        match = MOCK_KNOWLEDGE.sejuk;
      } else if (lower.includes("pantai") || lower.includes("laut") || lower.includes("sunset") || lower.includes("senja")) {
        match = MOCK_KNOWLEDGE.pantai;
      } else if (lower.includes("anak") || lower.includes("keluarga") || lower.includes("stroller")) {
        match = MOCK_KNOWLEDGE.keluarga;
      } else if (lower.includes("hujan") || lower.includes("indoor") || lower.includes("basah")) {
        match = MOCK_KNOWLEDGE.hujan;
      } else if (lower.includes("budaya") || lower.includes("candi") || lower.includes("sejarah") || lower.includes("keraton")) {
        match = MOCK_KNOWLEDGE.budaya;
      }

      const aiMsg: ChatMessage = {
        id: `ai-${++messageSeq.current}`,
        role: "assistant",
        content: match.answer,
        destinations: match.destinations,
        timestamp: formatCurrentTime(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsLoading(false);
    }, 450);
  };

  const resetChat = () => {
    setMessages([]);
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
            <p className="text-[11px] text-muted leading-tight">Didukung data cuaca BMKG DIY</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={resetChat}
              title="Bersihkan percakapan"
              aria-label="Bersihkan percakapan"
              className="rounded-md p-1.5 text-muted hover:bg-surface-soft hover:text-ink transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Tutup AI dan kembali ke daftar"
              aria-label="Tutup Wistara AI dan kembali ke daftar destinasi"
              className="rounded-md p-1.5 text-muted hover:bg-surface-soft hover:text-ink transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Konten Scrollable: Sambutan / Percakapan */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4 pt-2">
            {/* Salam Sambutan ala Google Maps */}
            <div className="text-center sm:text-left">
              <h3 className="font-serif text-[22px] font-bold text-ink">Halo Wisatawan!</h3>
              <p className="mt-1 text-[13.5px] text-muted leading-relaxed">
                Tanyakan apa saja seputar destinasi wisata, rekomendasi waktu terbaik, atau kondisi cuaca di Yogyakarta.
              </p>
            </div>

            {/* Grid 2-Kolom Kartu Prompt Cepat (Persis Google Maps) */}
            <div>
              <p className="mb-2 text-[12px] font-semibold text-muted tracking-wide uppercase">
                Ide pertanyaan cepat:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => handleSend(prompt.label)}
                    className="flex min-h-16 flex-col justify-between rounded-xl border border-hairline bg-surface-card p-3 text-left transition-all hover:border-primary/40 hover:bg-surface-soft hover:shadow-xs active:scale-[0.98]"
                  >
                    <span className="text-[12.5px] font-medium text-ink line-clamp-2 leading-snug">
                      {prompt.label}
                    </span>
                    <span className="mt-2 text-[11px] font-semibold text-primary inline-flex items-center gap-0.5">
                      Tanyakan →
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Info Sumber Data */}
            <div className="rounded-xl border border-hairline bg-surface-soft/60 p-3 text-[12px] text-muted leading-relaxed">
              💡 <strong>Tips Wistara:</strong> Rekomendasi dihitung otomatis dari prakiraan BMKG 3 hari ke depan dan fasilitas OpenStreetMap di sekitar destinasi.
            </div>
          </div>
        ) : (
          /* Daftar Pesan Obrolan */
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-xs ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-br-xs"
                      : "bg-surface-card border border-hairline text-body rounded-bl-xs"
                  }`}
                >
                  <p>{msg.content}</p>

                  {/* Kartu Destinasi Terkait (Rich Cards dengan Koneksi ke Peta) */}
                  {msg.destinations && msg.destinations.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2.5">
                      {msg.destinations.map((dest) => {
                        const enrichment = getDestinationEnrichment(dest.slug);
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
                                  {enrichment?.ticketPrice?.domestic ? ` · ${enrichment.ticketPrice.domestic}` : ""}
                                </p>
                              </div>
                              <ScoreChip score={dest.score} size="sm" />
                            </div>

                            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                              <span className="font-semibold text-ink">{dest.temp}°C</span>
                              <span>·</span>
                              <span>{dest.weatherDesc}</span>
                            </div>

                            <p className="mt-1.5 text-[11.5px] text-body italic leading-normal border-t border-hairline pt-1.5">
                              &ldquo;{dest.reason}&rdquo;
                            </p>

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
                </div>
                <span className="mt-1 px-1 text-[10px] text-muted">{msg.timestamp}</span>
              </div>
            ))}

            {/* Indikator Mengetik */}
            {isLoading && (
              <div className="flex items-center gap-1.5 rounded-2xl bg-surface-card border border-hairline px-3.5 py-2 text-xs text-muted w-fit">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 text-[11px]">Memeriksa prakiraan BMKG...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar di Bagian Bawah Panel Kiri (Persis Google Maps) */}
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
            placeholder="Tanyakan tentang wisata, cuaca, atau rekomendasi..."
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
