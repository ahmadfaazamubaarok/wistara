import { toSlotDto } from "@/lib/api/dto";
import { ApiError, withApi } from "@/lib/api/errors";
import { parseParams, parseQuery, publicJson } from "@/lib/api/http";
import { alternativesQuery, slugParams } from "@/lib/api/schemas";
import { getDestinationBySlug } from "@/lib/db/destinations";
import { alternativesBySlot, bestOtherSlot, isAlternativeTrigger } from "@/lib/forecast/alternatives";
import { getDestinationForecast } from "@/lib/forecast/destination-forecast";
import { SLOT_HOURS } from "@/lib/forecast/slots";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

const SLOT_MS = SLOT_HOURS * 60 * 60 * 1000;

// GET /api/v1/destinations/{slug}/alternatives?slot=2026-10-16T15:00:00+07:00
// Terpicu hanya bila skor slot < 50 dan penalti terbesarnya hujan (PRD F5).
export const GET = withApi<Context>(async (request, { params }) => {
  const { slug } = parseParams(slugParams, await params);
  const { slot: instant } = parseQuery(alternativesQuery, request);

  const destination = await getDestinationBySlug(slug);
  if (!destination) throw new ApiError("NOT_FOUND", `Destinasi "${slug}" tidak ditemukan`);

  const now = new Date();
  const forecast = await getDestinationForecast(destination, { days: 3, now });

  // Slot yang memuat waktu yang diminta (mulai <= waktu < mulai + 3 jam).
  const slot = forecast.slots.find((candidate) => {
    const start = new Date(candidate.validAt).getTime();
    return start <= instant.getTime() && instant.getTime() < start + SLOT_MS;
  });
  if (!slot) {
    throw new ApiError("NOT_FOUND", "Slot tidak ditemukan pada prakiraan 3 hari ke depan");
  }

  const triggered = isAlternativeTrigger(slot);
  const alternatives = triggered ? ((await alternativesBySlot(destination, [slot], now)).get(slot.validAt) ?? []) : [];

  return publicJson({
    destination: { slug: destination.slug },
    slot: toSlotDto(slot, alternatives.length > 0),
    triggered,
    alternatives,
    otherSlot:
      triggered && alternatives.length === 0
        ? (() => {
            const other = bestOtherSlot(forecast.slots, slot);
            return other ? toSlotDto(other, false) : null;
          })()
        : null,
  });
});
