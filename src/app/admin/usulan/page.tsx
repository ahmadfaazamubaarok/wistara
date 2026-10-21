import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { ReviewCard } from "@/components/submissions/review-card";
import { getPageUser } from "@/lib/auth/session";
import { CATEGORY_LABEL } from "@/lib/categories";
import { formatWibDateTime } from "@/lib/format";
import { SUBMISSION_STATUS_LABEL } from "@/lib/submissions/constants";
import { getReviewReference, isAdmin, listPendingForReview, listRecentlyReviewed } from "@/lib/submissions/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tinjau usulan destinasi",
  robots: { index: false },
};

export default async function ReviewSubmissionsPage() {
  const user = await getPageUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent("/admin/usulan")}`);
  // Non-admin mendapat 404 (bukan 403) agar keberadaan panel tidak terbuka.
  if (!(await isAdmin(user.id))) notFound();

  const [pending, reference, recent] = await Promise.all([
    listPendingForReview(user.id),
    getReviewReference(user.id),
    listRecentlyReviewed(user.id),
  ]);

  return (
    <>
      <main id="konten" className="mx-auto w-full max-w-[860px] flex-1 px-4 py-8 md:px-8 md:py-10">
        <h1>Tinjau usulan destinasi</h1>
        <p className="mt-3 max-w-[65ch]">
          Periksa lokasi, wilayah cuaca, dan kandidat duplikat sebelum menayangkan. Usulan yang disetujui langsung menjadi
          destinasi di katalog; usulan yang ditolak tetap tercatat bersama alasannya.
        </p>
        <p className="mt-1 text-[13px] text-muted">Masuk sebagai {user.email ?? "admin"}</p>

        <section aria-labelledby="menunggu" className="mt-8">
          <h2 id="menunggu">Menunggu ditinjau ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="mt-3 text-body">Tidak ada usulan yang menunggu.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-5">
              {pending.map((item) => (
                <ReviewCard key={item.id} item={item} reference={reference} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="riwayat" className="mt-12">
          <h2 id="riwayat">Keputusan terbaru</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-body">Belum ada keputusan.</p>
          ) : (
            <ul className="mt-4 divide-y divide-hairline rounded-lg border border-hairline">
              {recent.map((submission) => (
                <li key={submission.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                  <span>
                    <span className="font-medium text-ink">{submission.name}</span>{" "}
                    <span className="text-muted">
                      · {CATEGORY_LABEL[submission.category]} · {submission.reviewedAt ? formatWibDateTime(submission.reviewedAt) : ""}
                    </span>
                  </span>
                  <span className="text-body">
                    {SUBMISSION_STATUS_LABEL[submission.status]}
                    {submission.destination && (
                      <>
                        {" · "}
                        <Link href={`/destinasi/${submission.destination.slug}`} className="underline">
                          halaman
                        </Link>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
