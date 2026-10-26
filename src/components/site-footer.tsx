import Image from "next/image";
import Link from "next/link";
import { AttributionBar } from "./attribution-bar";

export function SiteFooter() {
  return (
    <footer className="mt-12 bg-surface-dark text-on-dark-soft">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-8 md:px-8">
        <p className="max-w-[70ch] text-sm leading-relaxed">
          Wistara memberi rekomendasi waktu kunjungan berdasarkan prakiraan, bukan jaminan kondisi di
          lokasi. Informasi resmi pengelola destinasi tentang penutupan atau keselamatan tetap yang utama.
        </p>
        <AttributionBar tone="dark" />
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <li>
            <Link className="inline-flex min-h-11 items-center text-on-dark" href="/tentang-data">
              Tentang Data dan metodologi skor
            </Link>
          </li>
          <li>
            <a className="inline-flex min-h-11 items-center text-on-dark" href="/api/docs">
              Dokumentasi API
            </a>
          </li>
          <li>
            <a className="inline-flex min-h-11 items-center text-on-dark" href="/api/v1/health">
              Status sistem
            </a>
          </li>
        </ul>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-on-dark-soft/20 pt-4">
          <div className="flex items-center gap-3">
            <Image src="/logo/uinic-putih.webp" alt="Logo UINIC 8.0" width={40} height={40} />
            <p className="text-[13px]">MVP UINIC 8.0 · Subtema Sosial Budaya</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[13px]">Dikembangkan oleh mahasiswa</p>
            <span className="inline-flex rounded-md bg-canvas px-2.5 py-1.5">
              <Image src="/logo/sibermu.webp" alt="Universitas Siber Muhammadiyah" width={132} height={31} />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
