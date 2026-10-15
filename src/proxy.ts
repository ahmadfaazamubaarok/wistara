// Menyegarkan sesi login pada setiap permintaan halaman: token akses berumur 1 jam dan hanya
// bisa diperbarui di sini (Server Component tidak boleh menulis cookie). Pengunjung tanpa cookie
// sesi dilewati tanpa panggilan jaringan apa pun.
//
// Catatan keamanan: proxy BUKAN pagar akses. Setiap halaman dan Server Action tetap memeriksa
// pengguna sendiri (getPageUser), sesuai panduan Next.js.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth/verify";
import { hasSessionCookie, SESSION_COOKIE_OPTIONS } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const config = authConfig();
  if (!config || !hasSessionCookie(request.cookies.getAll().map((c) => c.name))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // Memvalidasi token ke layanan Auth dan, bila perlu, menulis cookie hasil penyegaran.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Lewati aset statis dan API (API memakai Authorization: Bearer, bukan cookie).
  matcher: ["/((?!_next/static|_next/image|vendor/|api/|favicon.ico|icon.svg).*)"],
};
