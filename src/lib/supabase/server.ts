// Klien Supabase sisi-server berbasis cookie (untuk Server Component dan Server Action).
// Browser TIDAK pernah memanggil layanan Auth langsung: login lewat Server Action, token
// disimpan di cookie httpOnly sehingga tidak bisa dibaca skrip (XSS tidak mencuri sesi).

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfig } from "../auth/verify";

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Nama cookie sesi diawali "sb-". Dipakai untuk melewati panggilan jaringan bagi pengunjung anonim. */
export const hasSessionCookie = (names: string[]) => names.some((name) => name.startsWith("sb-"));

export async function createSupabaseServerClient() {
  const config = authConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Dipanggil dari Server Component: cookie tidak bisa ditulis di sini. Aman diabaikan,
          // karena src/proxy.ts menyegarkan sesi pada setiap permintaan.
        }
      },
    },
  });
}
