import { withApi } from "@/lib/api/errors";
import { noStoreJson, parseJsonBody, parseParams } from "@/lib/api/http";
import { enforceWriteLimit } from "@/lib/api/rate-limit";
import { addItemBody, tripIdParams } from "@/lib/api/schemas";
import { requireUser } from "@/lib/auth/guard";
import { addTripItem } from "@/lib/trips/service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

// POST /api/v1/trips/{id}/items {"destinationId": "...", "plannedSlot": "2026-10-16T15:00:00+07:00"}
// Idempoten: item yang sama (destinasi + slot) tidak digandakan, dibalas 200 dengan created=false.
export const POST = withApi<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = parseParams(tripIdParams, await params);
  const body = await parseJsonBody(addItemBody, request);
  await enforceWriteLimit(user.id);

  const plannedSlot = body.plannedSlot ? new Date(body.plannedSlot) : null;
  const result = await addTripItem(user.id, id, body.destinationId, plannedSlot);
  return noStoreJson(result, result.created ? 201 : 200);
});
