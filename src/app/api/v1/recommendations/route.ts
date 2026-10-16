import { withApi } from "@/lib/api/errors";
import { parseQuery, publicJson } from "@/lib/api/http";
import { recommendationsQuery } from "@/lib/api/schemas";
import { listDestinations } from "@/lib/db/destinations";
import { getManyForecasts } from "@/lib/forecast/destination-forecast";
import { bestOverlappingSlot } from "@/lib/forecast/slots";
import { toWibIsoString } from "@/lib/wib";

export const dynamic = "force-dynamic";

// GET /api/v1/recommendations?slot=2026-10-16T15:00:00+07:00&category=pantai,alam
// PRD F11: Destinasi terbaik lintas daftar untuk satu slot waktu yang dipilih.
export const GET = withApi(async (request) => {
  const { slot: instant, category } = parseQuery(recommendationsQuery, request);
  const destinations = await listDestinations(category ? { categories: category } : undefined);
  const now = new Date();
  const { bySlug } = await getManyForecasts(destinations, { days: 3, now });

  const recommendations = destinations.map((dest) => {
    const fc = bySlug.get(dest.slug);
    const matchedSlot = fc?.slots ? bestOverlappingSlot(fc.slots, instant.getTime()) : undefined;
    return {
      destination: {
        slug: dest.slug,
        name: dest.name,
        category: dest.category,
        isIndoor: dest.isIndoor,
        kabupaten: dest.region.kabupaten,
      },
      isOpen: matchedSlot?.isOpen ?? false,
      score: matchedSlot?.score ?? null,
      band: matchedSlot?.band ?? "closed",
      label: matchedSlot ? matchedSlot.label : "Tidak ada prakiraan",
      weatherDesc: matchedSlot?.weatherDesc ?? null,
      t: matchedSlot?.t ?? null,
      reasons: matchedSlot?.reasons ?? [],
    };
  });

  recommendations.sort((a, b) => {
    const sa = a.isOpen && a.score !== null ? a.score : -1;
    const sb = b.isOpen && b.score !== null ? b.score : -1;
    return sb - sa || a.destination.name.localeCompare(b.destination.name, "id");
  });

  return publicJson({
    slot: instant.toISOString(),
    localTime: toWibIsoString(instant),
    total: recommendations.length,
    recommendations,
  });
});

