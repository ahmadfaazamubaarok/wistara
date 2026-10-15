import { withApi } from "@/lib/api/errors";
import { noStoreJson, parseJsonBody, parseParams } from "@/lib/api/http";
import { enforceWriteLimit } from "@/lib/api/rate-limit";
import { tripBody, tripIdParams } from "@/lib/api/schemas";
import { requireUser } from "@/lib/auth/guard";
import { deleteTrip, renameTrip } from "@/lib/trips/service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

// PATCH /api/v1/trips/{id} {"title": "..."}: ubah judul. Rencana milik orang lain = 404.
export const PATCH = withApi<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = parseParams(tripIdParams, await params);
  const { title } = await parseJsonBody(tripBody, request);
  await enforceWriteLimit(user.id);
  return noStoreJson(await renameTrip(user.id, id, title));
});

// DELETE /api/v1/trips/{id}: hapus rencana beserta isinya.
export const DELETE = withApi<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = parseParams(tripIdParams, await params);
  await enforceWriteLimit(user.id);
  await deleteTrip(user.id, id);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
});
