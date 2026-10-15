import { toDestinationDto } from "@/lib/api/dto";
import { ApiError, withApi } from "@/lib/api/errors";
import { parseParams, publicJson } from "@/lib/api/http";
import { slugParams } from "@/lib/api/schemas";
import { getDestinationBySlug } from "@/lib/db/destinations";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

// GET /api/v1/destinations/{slug}
export const GET = withApi<Context>(async (_request, { params }) => {
  const { slug } = parseParams(slugParams, await params);
  const destination = await getDestinationBySlug(slug);
  if (!destination) throw new ApiError("NOT_FOUND", `Destinasi "${slug}" tidak ditemukan`);
  return publicJson(toDestinationDto(destination));
});
