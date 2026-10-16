import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <main id="konten" className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-start gap-4 px-4 py-12 md:px-8">
        <h1>Halaman tidak ditemukan</h1>
        <p className="max-w-[60ch]">Alamat yang Anda buka tidak ada di Wistara.</p>
        <Link href="/" className={buttonClass.primary}>
          Kembali ke Beranda
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
