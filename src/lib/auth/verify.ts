// Memverifikasi token akses (JWT) lewat layanan Auth (GoTrue lokal / Supabase Auth).
// Sengaja dipisah dari guard.ts agar tes bisa menggantinya tanpa menjalankan GoTrue.

import { createClient } from "@supabase/supabase-js";

export type AuthUser = { id: string; email: string | null };

/** Layanan Auth tidak dikonfigurasi atau tidak terjangkau (bukan sekadar token yang salah). */
export class AuthUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthUnavailableError";
  }
}

export function authConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/**
 * @returns pengguna bila token valid; null bila token salah/kedaluwarsa.
 * @throws AuthUnavailableError bila layanan Auth tidak dikonfigurasi atau tidak terjangkau.
 */
export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  const config = authConfig();
  if (!config) throw new AuthUnavailableError("SUPABASE_URL / SUPABASE_ANON_KEY belum diatur");

  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    // 4xx = token ditolak oleh Auth. Selain itu (jaringan, 5xx) = layanan bermasalah.
    if (error.status && error.status >= 400 && error.status < 500) return null;
    throw new AuthUnavailableError(error.message);
  }
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
