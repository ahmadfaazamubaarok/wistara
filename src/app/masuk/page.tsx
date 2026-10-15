import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { SiteFooter } from "@/components/site-footer";
import { safeNext } from "@/lib/auth/safe-next";
import { getPageUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Masuk",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ next?: string; mode?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const mode = params.mode === "daftar" ? "daftar" : "masuk";

  // Sudah login: tidak perlu formulir.
  if (await getPageUser()) redirect(next);

  const other = mode === "masuk" ? "daftar" : "masuk";
  const switchHref = `/masuk?mode=${other}${params.next ? `&next=${encodeURIComponent(next)}` : ""}`;

  return (
    <>
      <main id="konten" className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-2">
          <h1>{mode === "masuk" ? "Masuk" : "Buat akun"}</h1>
          <p className="text-body">
            {mode === "masuk"
              ? "Masuk untuk menyimpan dan membuka kembali rencana kunjungan Anda."
              : "Daftar dengan email untuk menyimpan rencana kunjungan. Gratis."}
          </p>
        </header>

        <AuthForm mode={mode} next={next} />

        <p className="text-sm text-body">
          {mode === "masuk" ? "Belum punya akun? " : "Sudah punya akun? "}
          <Link href={switchHref}>{mode === "masuk" ? "Buat akun" : "Masuk"}</Link>
        </p>

        <p className="rounded-md bg-surface-card p-3 text-[13px] text-muted">
          Yang kami simpan hanya email dan rencana kunjungan Anda. Lokasi perangkat tidak pernah disimpan.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
