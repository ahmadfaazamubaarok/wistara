import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/components/ui";

export default function DestinationNotFound() {
  return (
    <>
      <main id="konten" className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-start gap-4 px-4 py-12 md:px-8">
        <h1>Destinasi tidak ditemukan</h1>
        <p className="max-w-[60ch]">
          Alamat yang Anda buka tidak cocok dengan salah satu dari 20 destinasi di Wistara. Mungkin tautannya salah ketik.
        </p>
        <Link href="/" className={buttonClass.primary}>
          Lihat semua destinasi
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
