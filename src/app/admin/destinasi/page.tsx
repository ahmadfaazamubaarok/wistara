import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { DeleteDestinationButton } from "@/components/admin/delete-destination-button";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/components/ui";
import { listAdminDestinations } from "@/lib/admin/destinations";
import { getPageUser } from "@/lib/auth/session";
import { CATEGORY_LABEL, DEST_CATEGORIES } from "@/lib/categories";
import { KABUPATEN_DIY } from "@/lib/submissions/constants";
import { isAdmin } from "@/lib/submissions/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kelola Destinasi",
  robots: { index: false },
};

type Props = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    kabupaten?: string;
    page?: string;
  }>;
};

export default async function AdminDestinasiPage({ searchParams }: Props) {
  const user = await getPageUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent("/admin/destinasi")}`);
  if (!(await isAdmin(user.id))) notFound();

  const params = await searchParams;
  const q = params.q ?? "";
  const category = params.category ?? "";
  const kabupaten = params.kabupaten ?? "";
  const page = parseInt(params.page ?? "1", 10) || 1;

  const data = await listAdminDestinations(user.id, {
    q,
    category,
    kabupaten,
    page,
    limit: 20,
  });

  const makePageUrl = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (category) sp.set("category", category);
    if (kabupaten) sp.set("kabupaten", kabupaten);
    sp.set("page", String(targetPage));
    return `/admin/destinasi?${sp.toString()}`;
  };

  return (
    <>
      <main id="konten" className="mx-auto w-full max-w-[1040px] flex-1 px-4 py-8 md:px-8 md:py-10">
        <AdminNav />

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1>Kelola Destinasi</h1>
            <p className="mt-1 text-sm text-muted">
              Total {data.total} destinasi terdaftar dalam katalog Wistara.
            </p>
          </div>
          <Link href="/admin/destinasi/baru" className={buttonClass.primary}>
            + Tambah Destinasi
          </Link>
        </div>

        {/* Filter bar */}
        <form method="get" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface-card p-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="q" className="sr-only">
              Cari nama atau slug
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Cari nama atau slug destinasi…"
              className="min-h-10 w-full rounded-md border border-border-input bg-canvas px-3 text-sm text-ink placeholder:text-muted"
            />
          </div>

          <div className="w-[160px]">
            <label htmlFor="category" className="sr-only">
              Kategori
            </label>
            <select
              id="category"
              name="category"
              defaultValue={category}
              className="min-h-10 w-full rounded-md border border-border-input bg-canvas px-3 text-sm text-ink"
            >
              <option value="">Semua Kategori</option>
              {DEST_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABEL[cat]}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[180px]">
            <label htmlFor="kabupaten" className="sr-only">
              Kabupaten / Kota
            </label>
            <select
              id="kabupaten"
              name="kabupaten"
              defaultValue={kabupaten}
              className="min-h-10 w-full rounded-md border border-border-input bg-canvas px-3 text-sm text-ink"
            >
              <option value="">Semua Wilayah</option>
              {KABUPATEN_DIY.map((kab) => (
                <option key={kab} value={kab}>
                  {kab}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className={`${buttonClass.secondary} min-h-10 px-4 text-sm`}>
            Filter
          </button>
          {(q || category || kabupaten) && (
            <Link href="/admin/destinasi" className="text-sm text-muted underline hover:text-ink">
              Reset
            </Link>
          )}
        </form>

        {/* Tabel Destinasi */}
        <div className="mt-6 overflow-x-auto rounded-lg border border-hairline bg-canvas">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-surface-soft text-xs font-semibold text-muted">
              <tr>
                <th className="px-4 py-3">Destinasi</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Wilayah</th>
                <th className="px-4 py-3">Jam Buka</th>
                <th className="px-4 py-3">Asal</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Tidak ada destinasi yang sesuai dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-soft/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{item.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>slug: {item.slug}</span>
                        <span>·</span>
                        <Link
                          href={`/destinasi/${item.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-ink"
                        >
                          lihat publik ↗
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-block rounded bg-surface-soft px-2 py-0.5 text-xs text-ink">
                        {CATEGORY_LABEL[item.category]}
                      </span>
                      {item.isIndoor && (
                        <span className="ml-1.5 inline-block text-[11px] text-muted">Indoor</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-body">
                      <div>{item.region.kabupaten}</div>
                      <div className="text-muted">
                        {item.region.kecamatan}, {item.region.desa}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-body">
                      {item.openHours ? (
                        <span className="text-score-good-text">Tersedia</span>
                      ) : (
                        <span className="text-muted">Tanpa batas jam</span>
                      )}
                      {item.verifiedAt && (
                        <div className="text-[11px] text-muted">Terverifikasi {item.verifiedAt}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                          item.origin === "usulan"
                            ? "bg-score-good-bg text-score-good-text"
                            : "bg-surface-soft text-muted"
                        }`}
                      >
                        {item.origin === "usulan" ? "Usulan" : "Seed"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/destinasi/${item.id}`}
                          className="rounded px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-soft"
                        >
                          Edit
                        </Link>
                        <DeleteDestinationButton id={item.id} name={item.name} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4 text-sm">
            <span className="text-muted">
              Halaman {data.page} dari {data.totalPages}
            </span>
            <div className="flex gap-2">
              {data.page > 1 ? (
                <Link href={makePageUrl(data.page - 1)} className={`${buttonClass.secondary} min-h-9 px-3 text-xs`}>
                  ← Sebelumnya
                </Link>
              ) : (
                <span className={`${buttonClass.secondary} min-h-9 px-3 text-xs opacity-40 pointer-events-none`}>
                  ← Sebelumnya
                </span>
              )}
              {data.page < data.totalPages ? (
                <Link href={makePageUrl(data.page + 1)} className={`${buttonClass.secondary} min-h-9 px-3 text-xs`}>
                  Selanjutnya →
                </Link>
              ) : (
                <span className={`${buttonClass.secondary} min-h-9 px-3 text-xs opacity-40 pointer-events-none`}>
                  Selanjutnya →
                </span>
              )}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
