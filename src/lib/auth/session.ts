// Pengguna yang sedang login untuk halaman dan Server Action (berbasis cookie).

import { cookies } from "next/headers";
import { cache } from "react";
import { createSupabaseServerClient, hasSessionCookie } from "../supabase/server";
import type { AuthUser } from "./verify";

/**
 * Pengguna dari cookie sesi, divalidasi ke layanan Auth (bukan sekadar membaca cookie, karena
 * cookie bisa dipalsukan). Pengunjung tanpa cookie sesi tidak memicu panggilan jaringan.
 * Dibungkus cache() agar header dan halaman tidak memanggil Auth dua kali dalam satu permintaan.
 */
export const getPageUser = cache(async (): Promise<AuthUser | null> => {
  const cookieStore = await cookies();
  if (!hasSessionCookie(cookieStore.getAll().map((c) => c.name))) return null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
});
