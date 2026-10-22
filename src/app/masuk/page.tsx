import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GoogleAuthButton } from "@/components/auth/auth-form";
import { SiteFooter } from "@/components/site-footer";
import { safeNext } from "@/lib/auth/safe-next";
import { getPageUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Masuk ke Wistara",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNext(params.next);

  // Sudah login: tidak perlu halaman masuk.
  if (await getPageUser()) redirect(next);

  const error = params.error;

  return (
    <>
      <main id="konten" className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-6 px-4 py-12">
        <header className="flex flex-col gap-2 text-center">
          <h1>Masuk ke Wistara</h1>
          <p className="text-sm text-body">
            Gunakan akun Google Anda untuk masuk atau mendaftar secara praktis, cepat, dan aman.
          </p>
        </header>

        {error && (
          <div role="alert" className="rounded-md bg-score-bad-bg p-3.5 text-sm text-score-bad-text">
            {error === "oauth" || error === "oauth_failed"
              ? "Gagal menghubungkan ke akun Google. Pastikan izin akses diberikan dan konfigurasi Google OAuth di Supabase sudah aktif."
              : error === "unavailable"
                ? "Layanan autentikasi sedang tidak tersedia. Silakan coba sesaat lagi."
                : `Terjadi kendala: ${error}`}
          </div>
        )}

        <div className="rounded-xl border border-hairline bg-surface-card p-6 shadow-sm">
          <GoogleAuthButton next={next} />

          <p className="mt-4 text-center text-xs text-muted">
            Dengan masuk, Anda dapat menyimpan rencana kunjungan cerdas Anda di Wistara.
          </p>
        </div>

        <p className="rounded-md bg-surface-soft p-3 text-center text-[12px] text-muted">
          Yang kami simpan hanya identitas akun Google Anda dan rencana kunjungan. Lokasi perangkat Anda tidak pernah disimpan ke server.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
