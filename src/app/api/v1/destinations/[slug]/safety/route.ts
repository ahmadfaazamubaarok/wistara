import { ApiError, withApi } from "@/lib/api/errors";
import { parseParams, publicJson } from "@/lib/api/http";
import { slugParams } from "@/lib/api/schemas";
import { getBeachSafety, getDestinationBySlug } from "@/lib/db/destinations";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

// GET /api/v1/destinations/{slug}/safety
// Data kurasi keselamatan pantai (status berenang, potensi bahaya, pos SAR).
export const GET = withApi<Context>(async (_request, { params }) => {
  const { slug } = parseParams(slugParams, await params);

  const destination = await getDestinationBySlug(slug);
  if (!destination) {
    throw new ApiError("NOT_FOUND", `Destinasi "${slug}" tidak ditemukan`);
  }

  if (destination.category !== "pantai") {
    throw new ApiError("NOT_FOUND", `Destinasi "${slug}" bukan kategori pantai`);
  }

  const safety = await getBeachSafety(destination.id);

  if (!safety) {
    return publicJson({
      destination: { slug: destination.slug },
      verified: false,
      data: null,
    });
  }

  return publicJson({
    destination: { slug: destination.slug },
    verified: true,
    data: {
      swimStatus: safety.swimStatus,
      hazards: safety.hazards,
      sarPostName: safety.sarPostName,
      sarPostLocation: safety.sarPostLocation,
      guardHours: safety.guardHours,
      emergencyContact: safety.emergencyContact,
      notes: safety.notes,
      incidentRefs: safety.incidentRefs,
      sourceUrl: safety.sourceUrl,
      verifiedAt: safety.verifiedAt,
    },
  });
});
