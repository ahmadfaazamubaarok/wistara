import { toDestinationDto } from "@/lib/api/dto";
import { withApi } from "@/lib/api/errors";
import { parseQuery, publicJson } from "@/lib/api/http";
import { destinationsQuery } from "@/lib/api/schemas";
import { listDestinations } from "@/lib/db/destinations";
import { getManyForecasts } from "@/lib/forecast/destination-forecast";

export const dynamic = "force-dynamic";

// GET /api/v1/destinations?category=pantai,alam&q=parang&bbox=110,-8.2,110.6,-7.6&include=scores
export const GET = withApi(async (request) => {
  const { category, q, bbox, include } = parseQuery(destinationsQuery, request);
  const destinations = await listDestinations({ categories: category, q, bbox });

  if (include !== "scores") {
    return publicJson({ destinations: destinations.map(toDestinationDto) });
  }

  const { bySlug, source, dayKeys } = await getManyForecasts(destinations);
  return publicJson({
    destinations: destinations.map((destination) => ({
      ...toDestinationDto(destination),
      bestByDay: bySlug.get(destination.slug)?.bestByDay ?? [],
    })),
    days: dayKeys,
    ...(source ? { source } : {}),
  });
});
