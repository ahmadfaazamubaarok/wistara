import { z } from "zod";
import { ApiError, withApi } from "@/lib/api/errors";
import { noStoreJson, parseJsonBody } from "@/lib/api/http";
import { getPageUser } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { getActiveAlertsForDestination, listActiveAlerts } from "@/lib/db/alerts";
import { facilitiesNear, indoorCandidates, listDestinations } from "@/lib/db/destinations";
import { getDestinationEnrichment } from "@/lib/destination-enrichment";
import { getManyForecasts } from "@/lib/forecast/destination-forecast";
import { ALT_MAX, ALT_MIN_SCORE, ALT_RADIUS_M, type Alternative } from "@/lib/forecast/alternatives";
import { bestOverlappingSlot } from "@/lib/forecast/slots";
import { getDestinationAttribute } from "@/lib/ai/attributes";
import { runEngine, type EngineDestination } from "@/lib/ai/engine";
import { isAiAvailable, rewriteWithGemini, understandWithGemini } from "@/lib/ai/gemini";
import { mergeUnderstanding } from "@/lib/ai/understand";
import { validateReply } from "@/lib/ai/validator";
import { getWibDateKey } from "@/lib/wib";

export const dynamic = "force-dynamic";

const slugPattern = /^[a-z0-9-]{1,80}$/;

const requestSchema = z.object({
  message: z.string().trim().min(1, "Pertanyaan tidak boleh kosong").max(500, "Pertanyaan maksimal 500 karakter"),
  /** Percakapan sebelumnya (maks. 6 giliran) untuk pertanyaan lanjutan. */
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(600) }))
    .max(6)
    .optional()
    .default([]),
  /** Slug destinasi pada jawaban terakhir, supaya "yang kedua" atau "buka jam berapa?" bisa dirujuk. */
  focus: z.array(z.string().regex(slugPattern)).max(3).optional().default([]),
});

async function checkAiRateLimit(userId: string | null, clientIp: string) {
  try {
    const pool = getPool();
    // 1. Batas harian global (pemutus darurat kuota)
    const globalCap = parseInt(process.env.AI_DAILY_LIMIT || "500", 10);
    const { rows: globalRows } = await pool.query<{ allowed: boolean; hits: number; retry_after: number }>(
      "select * from rate_limit_hit($1, $2, $3)",
      ["ai:global:daily", globalCap, 86400],
    );
    if (globalRows[0] && !globalRows[0].allowed) {
      throw new ApiError("RATE_LIMITED", "Batas harian Wistara AI tercapai. Silakan coba kembali besok.");
    }

    // 2. Batas per pengguna / tamu
    const isDev = process.env.NODE_ENV !== "production";
    const defaultGuestLimit = isDev ? "200" : "20";
    const defaultUserLimit = isDev ? "500" : "60";
    const limit = userId
      ? parseInt(process.env.AI_RATE_USER_PER_HOUR || defaultUserLimit, 10)
      : parseInt(process.env.AI_RATE_GUEST_PER_HOUR || defaultGuestLimit, 10);
    const key = userId ? `ai:user:${userId}` : `ai:guest:${clientIp}`;

    const { rows } = await pool.query<{ allowed: boolean; hits: number; retry_after: number }>(
      "select * from rate_limit_hit($1, $2, $3)",
      [key, limit, 3600],
    );
    if (rows[0] && !rows[0].allowed) {
      throw new ApiError(
        "RATE_LIMITED",
        `Terlalu banyak pertanyaan (maksimal ${limit}/jam). Coba lagi dalam ${rows[0].retry_after} detik.`,
        { "Retry-After": String(rows[0].retry_after) },
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Abaikan jika tabel rate limit sedang tidak aktif di mode lokal
  }
}

const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// POST /api/v1/assistant
// Kode memutuskan, model menjelaskan: lihat src/lib/ai/engine.ts.
export const POST = withApi(async (request) => {
  const startedAt = Date.now();
  const user = await getPageUser();
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  await checkAiRateLimit(user ? user.id : null, clientIp);
  const { message, history, focus } = await parseJsonBody(requestSchema, request);

  const now = new Date();
  const destinations = await listDestinations();
  const catalog = destinations.map((d) => ({ slug: d.slug, name: d.name }));

  // Pemahaman: model (bila tersedia) digabung dengan deteksi deterministik.
  const todayKey = getWibDateKey(now);
  const todayLabel = `${WEEKDAYS[new Date(`${todayKey}T00:00:00Z`).getUTCDay()]}, ${todayKey} (WIB)`;
  // Model dipanggil hanya bila deteksi kode belum yakin (hemat kuota dan lebih cepat).
  let understanding = mergeUnderstanding(message, { now, catalog, focus }, null);
  const uncertain =
    understanding.intent === "clarify" ||
    (understanding.intent === "recommend" &&
      understanding.slugs.length === 0 &&
      understanding.preferences.length === 0 &&
      understanding.categories.length === 0 &&
      understanding.when.dayOffset === null &&
      understanding.when.part === null);
  const modelUnderstanding = uncertain && isAiAvailable()
    ? await understandWithGemini(message, { todayLabel, catalog, history, focus })
    : null;
  if (modelUnderstanding) understanding = mergeUnderstanding(message, { now, catalog, focus }, modelUnderstanding);

  // Data: prakiraan, peringatan dini, pengayaan.
  const { bySlug } = await getManyForecasts(destinations, { days: 3, now });
  const activeAlerts = await listActiveAlerts(now);
  const items: EngineDestination[] = await Promise.all(
    destinations.map(async (dest) => {
      const alerts = activeAlerts.length > 0 ? await getActiveAlertsForDestination(dest, now) : [];
      return {
        ...dest,
        slots: bySlug.get(dest.slug)?.slots ?? [],
        enrichment: getDestinationEnrichment(dest.slug),
        attr: getDestinationAttribute(dest.slug, dest.isIndoor),
        alert: alerts[0] ?? null,
      };
    }),
  );

  const result = await runEngine({
    now,
    query: message,
    intent: understanding.intent,
    unsupported: understanding.unsupported,
    when: understanding.when,
    slugs: understanding.slugs,
    unknownPlaces: understanding.unknownPlaces,
    ambiguousReference: understanding.ambiguousReference,
    categories: understanding.categories,
    preferences: understanding.preferences,
    topics: understanding.topics,
    days: understanding.days,
    isLoggedIn: Boolean(user),
    items,
    fetchFacilities: (dest) => facilitiesNear(dest.id, 1000, ["toilet", "parkir", "makan", "ibadah", "atm"]),
    // Alternatif ruang tertutup dekat destinasi, dinilai pada slot yang sama dari prakiraan yang sudah dimuat.
    fetchAlternatives: async (dest, slot) => {
      const candidates = await indoorCandidates(dest.id, ALT_RADIUS_M);
      const list: Alternative[] = [];
      for (const candidate of candidates) {
        const item = items.find((i) => i.slug === candidate.slug);
        if (!item || item.alert) continue;
        const there = bestOverlappingSlot(item.slots, new Date(slot.validAt).getTime());
        if (!there || !there.isOpen || there.score === null || there.score < ALT_MIN_SCORE) continue;
        list.push({
          slug: candidate.slug,
          name: candidate.name,
          category: candidate.category,
          distanceM: candidate.distanceM,
          score: there.score,
          label: there.label,
          band: there.band,
        });
      }
      list.sort((a, b) => a.distanceM - b.distanceM || b.score - a.score);
      return list.slice(0, ALT_MAX);
    },
  });

  // Penjelasan: model boleh merapikan kalimat, tetapi hanya bila lolos validator.
  let reply = result.baseReply;
  let source: "model" | "template" = "template";
  let rejected: string | null = null;
  if (result.allowRewrite && isAiAvailable()) {
    const rewritten = await rewriteWithGemini({ query: message, baseReply: result.baseReply, cards: result.cards, notices: result.notices });
    if (rewritten) {
      const verdict = validateReply(rewritten, {
        allowedText: [result.baseReply, JSON.stringify(result.cards), result.notices.join(" "), message].join(" "),
        catalog,
        allowedSlugs: [...result.cards.map((c) => c.slug), ...understanding.slugs],
      });
      if (verdict.ok) {
        reply = rewritten;
        source = "model";
      } else {
        rejected = verdict.reason;
      }
    }
  }

  // Hanya metadata (tanpa teks pengguna) agar privasi terjaga.
  console.info(
    `[ai] intent=${result.type} source=${source} cards=${result.cards.length} unavailable=${result.unavailable.length}` +
      `${rejected ? ` ditolak="${rejected}"` : ""} ms=${Date.now() - startedAt}`,
  );

  return noStoreJson({
    type: result.type,
    reply,
    cards: result.cards,
    itinerary: result.itinerary,
    canSave: Boolean(user),
    notices: result.notices,
    unavailable: result.unavailable,
    suggestions: result.suggestions.slice(0, 4),
    focus: result.focus,
    source,
  });
});
