import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

  const targetOrigin = envUrl
    ? envUrl.replace(/\/+$/, "")
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : requestOrigin;

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${targetOrigin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${targetOrigin}/masuk?error=oauth`);
}
