import { ApiError, withApi } from "@/lib/api/errors";
import { parseParams, parseQuery, publicJson } from "@/lib/api/http";
import { facilitiesQuery, slugParams } from "@/lib/api/schemas";
import { OSM_ATTRIBUTION } from "@/lib/attribution";
import { FACILITY_TYPES } from "@/lib/categories";
import { facilitiesNear, getDestinationBySlug } from "@/lib/db/destinations";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

// GET /api/v1/destinations/{slug}/facilities?radius=1000&type=toilet,parkir
export const GET = withApi<Context>(async (request, { params }) => {
  const { slug } = parseParams(slugParams, await params);
  const { radius, type } = parseQuery(facilitiesQuery, request);

  const destination = await getDestinationBySlug(slug);
  if (!destination) throw new ApiError("NOT_FOUND", `Destinasi "${slug}" tidak ditemukan`);

  const requested = type ?? [...FACILITY_TYPES];
  const facilities = await facilitiesNear(destination.id, radius, requested);
  const found = new Set(facilities.map((facility) => facility.type));

  return publicJson({
    destination: { slug: destination.slug },
    radiusM: radius,
    facilities,
    missingTypes: requested.filter((t) => !found.has(t)),
    attribution: OSM_ATTRIBUTION,
  });
});
