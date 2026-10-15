import { publicJson } from "@/lib/api/http";
import { buildOpenApiDocument } from "@/lib/api/openapi";
import { withApi } from "@/lib/api/errors";

// GET /api/openapi.json: spesifikasi OpenAPI 3.1 yang dibangun dari skema Zod.
export const GET = withApi(async () => publicJson(buildOpenApiDocument()));
