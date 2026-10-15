// Penjaga endpoint yang butuh login: Authorization: Bearer <access_token>.

import { ApiError } from "../api/errors";
import { verifyAccessToken, type AuthUser } from "./verify";

export async function requireUser(request: Request): Promise<AuthUser> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) {
    throw new ApiError("UNAUTHORIZED", "Login diperlukan. Kirim header Authorization: Bearer <access_token>.", {
      "WWW-Authenticate": "Bearer",
    });
  }

  let user: AuthUser | null;
  try {
    user = await verifyAccessToken(match[1]);
  } catch (error) {
    console.error("[auth] layanan Auth tidak tersedia:", error instanceof Error ? error.message : error);
    throw new ApiError("UPSTREAM_UNAVAILABLE", "Layanan login sedang tidak tersedia. Coba lagi sebentar lagi.");
  }

  if (!user) {
    throw new ApiError("UNAUTHORIZED", "Token tidak valid atau sudah kedaluwarsa.", {
      "WWW-Authenticate": 'Bearer error="invalid_token"',
    });
  }
  return user;
}
