import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteSubmissionAction } from "@/app/actions/submissions";
import { SiteFooter } from "@/components/site-footer";
import { SubmissionForm } from "@/components/submissions/submission-form";
import { ConfirmDelete } from "@/components/trips/confirm-delete";
import { buttonClass } from "@/components/ui";
import { getPageUser } from "@/lib/auth/session";
import { CATEGORY_LABEL } from "@/lib/categories";
import { formatWibDateTime } from "@/lib/format";
import { SUBMISSION_STATUS_LABEL, type SubmissionStatus } from "@/lib/submissions/constants";
import { listMySubmissions } from "@/lib/submissions/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Usulkan destinasi",
  robots: { index: false },
};

const DEFAULT_MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  menunggu: "bg-banner-stale-bg text-banner-stale-text",
  disetujui: "bg-score-good-bg text-score-good-text",
  ditolak: "bg-score-bad-bg text-score-bad-text",
};

export default async function SubmitPage() {
  const user = await getPageUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent("/usul")}`);

  const submissions = await listMySubmissions(user.id);

  return (
    <>
      <main id="konten" className="mx-auto w-full max-w-[860px] flex-1 px-4 py-8 md:px-8 md:py-10">
        <h1>Usulkan destinasi</h1>
        <p className="mt-3 max-w-[65ch]">
          Pengelola, pemilik, atau pemerintah desa dapat mengusulkan destinasi wisata di Daerah Istimewa Yogyakarta agar ikut
          dihitung waktu terbaik kunjungannya. Usulan <strong>tidak langsung tampil</strong>: tim Wistara memeriksa lokasi dan jam
          bukanya terlebih dulu.
        </p>
        <p className="mt-1 text-[13px] text-muted">Masuk sebagai {user.email ?? "pengguna"}</p>

        <section aria-labelledby="form-usulan" className="mt-8">
          <h2 id="form-usulan" className="sr-only">
            Formulir usulan
          </h2>
          <SubmissionForm mapStyleUrl={process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE} />
        </section>

        <section aria-labelledby="usulan-saya" className="mt-12">
          <h2 id="usulan-saya">Usulan saya</h2>
          {submissions.length === 0 ? (
            <p className="mt-3 text-body">Belum ada usulan.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {submissions.map((submission) => (
                <li key={submission.id} className="rounded-lg border border-hairline p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="!text-[17px] font-semibold text-ink">{submission.name}</h3>
                      <p className="text-[13px] text-muted">
                        {CATEGORY_LABEL[submission.category]} · {submission.kabupaten} · dikirim{" "}
                        {formatWibDateTime(submission.createdAt)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${STATUS_STYLE[submission.status]}`}>
                      {SUBMISSION_STATUS_LABEL[submission.status]}
                    </span>
                  </div>

                  {submission.reviewNote && (
                    <p className="mt-2 text-sm text-body">
                      <span className="font-medium text-ink">Catatan peninjau:</span> {submission.reviewNote}
                    </p>
                  )}

                  {submission.status === "disetujui" && submission.destination && (
                    <Link href={`/destinasi/${submission.destination.slug}`} className={`${buttonClass.secondary} mt-3`}>
                      Lihat halaman destinasi
                    </Link>
                  )}

                  {submission.status === "menunggu" && (
                    <div className="mt-3">
                      <ConfirmDelete
                        action={deleteSubmissionAction}
                        fields={{ submissionId: submission.id }}
                        triggerLabel="Tarik usulan"
                        triggerClassName={buttonClass.secondary}
                        triggerAriaLabel={`Tarik usulan ${submission.name}`}
                        title="Tarik usulan ini?"
                        description={`Usulan "${submission.name}" akan dihapus dari antrean peninjauan.`}
                        confirmLabel="Tarik usulan"
                      />
                    </div>
                  )}
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
