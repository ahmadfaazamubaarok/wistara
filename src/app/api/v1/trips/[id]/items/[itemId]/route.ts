import { withApi } from "@/lib/api/errors";
import { parseParams } from "@/lib/api/http";
import { enforceWriteLimit } from "@/lib/api/rate-limit";
import { tripItemParams } from "@/lib/api/schemas";
import { requireUser } from "@/lib/auth/guard";
import { deleteTripItem } from "@/lib/trips/service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; itemId: string }> };

// DELETE /api/v1/trips/{id}/items/{itemId}
export const DELETE = withApi<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id, itemId } = parseParams(tripItemParams, await params);
  await enforceWriteLimit(user.id);
  await deleteTripItem(user.id, id, itemId);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
});
