"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UNAVAILABLE = "Layanan login belum tersedia atau sedang bermasalah. Coba lagi sebentar lagi.";

function getAppOrigin(headersList: Headers): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const forwardedHost = headersList.get("x-forwarded-host");
  const host = forwardedHost || headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");

  if (host) return `${proto}://${host}`;
  return "https://wistara.ai.id";
}

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/masuk?error=unavailable");

  const headersList = await headers();
  const origin = getAppOrigin(headersList);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect(`/masuk?error=${encodeURIComponent(error?.message ?? "oauth_failed")}`);
  }

  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/");
}
