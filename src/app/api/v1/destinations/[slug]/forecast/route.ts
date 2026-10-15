import { compact, toSlotDto } from "@/lib/api/dto";
import { ApiError, withApi } from "@/lib/api/errors";
import { parseParams, parseQuery, publicJson } from "@/lib/api/http";
import { forecastQuery, slugParams } from "@/lib/api/schemas";
import { getDestinationBySlug } from "@/lib/db/destinations";
import { alternativesBySlot } from "@/lib/forecast/alternatives";
import { getDestinationForecast } from "@/lib/forecast/destination-forecast";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

// GET /api/v1/destinations/{slug}/forecast?days=3
// Prakiraan BMKG per slot 3 jam + skor kelayakan. Saat BMKG gagal, data terakhir
// tetap dikirim dengan source.isStale = true (status tetap 200).
export const GET = withApi<Context>(async (request, { params }) => {
  const { slug } = parseParams(slugParams, await params);
  const { days } = parseQuery(forecastQuery, request);

  const destination = await getDestinationBySlug(slug);
  if (!destination) throw new ApiError("NOT_FOUND", `Destinasi "${slug}" tidak ditemukan`);

  const now = new Date();
  const forecast = await getDestinationForecast(destination, { days, now });
  const alternatives = await alternativesBySlot(destination, forecast.slots, now);

  return publicJson({
    destination: { slug: destination.slug, category: destination.category },
    source: forecast.source,
    slots: forecast.slots.map((slot) => toSlotDto(slot, (alternatives.get(slot.validAt)?.length ?? 0) > 0)),
    bestByDay: compact(forecast.bestByDay),
  });
});
