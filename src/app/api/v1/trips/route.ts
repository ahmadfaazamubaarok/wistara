import { withApi } from "@/lib/api/errors";
import { noStoreJson, parseJsonBody } from "@/lib/api/http";
import { enforceWriteLimit } from "@/lib/api/rate-limit";
import { tripBody } from "@/lib/api/schemas";
import { requireUser } from "@/lib/auth/guard";
import { createTrip, listTrips } from "@/lib/trips/service";

export const dynamic = "force-dynamic";

// GET /api/v1/trips: rencana milik pengguna yang login (Authorization: Bearer <access_token>).
export const GET = withApi(async (request) => {
  const user = await requireUser(request);
  return noStoreJson({ trips: await listTrips(user.id) });
});

// POST /api/v1/trips {"title": "..."}: buat rencana (1-80 karakter).
export const POST = withApi(async (request) => {
  const user = await requireUser(request);
  const { title } = await parseJsonBody(tripBody, request);
  await enforceWriteLimit(user.id);
  return noStoreJson(await createTrip(user.id, title), 201);
});
