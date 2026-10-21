"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { approveSubmissionAction, rejectSubmissionAction, type ReviewActionState } from "@/app/actions/submissions";
import { buttonClass } from "@/components/ui";
import { CATEGORY_LABEL } from "@/lib/categories";
import { formatWibDateTime } from "@/lib/format";
import { MANAGER_ROLE_LABEL } from "@/lib/submissions/constants";
import { summarizeOpenHours } from "@/lib/submissions/format";
import type { ReviewItem, ReviewReference } from "@/lib/submissions/service";

const INPUT = "min-h-11 w-full rounded-md border border-border-input bg-canvas px-3 text-base text-ink placeholder:text-muted";
const initial: ReviewActionState = {};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-[15px] text-ink">{children}</dd>
    </div>
  );
}

export function ReviewCard({ item, reference }: { item: ReviewItem; reference: ReviewReference }) {
  const [approveState, approve, approving] = useActionState(approveSubmissionAction, initial);
  const [rejectState, reject, rejecting] = useActionState(rejectSubmissionAction, initial);
  const id = `tinjau-${item.id}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`;

  return (
    <article aria-labelledby={`${id}-judul`} className="rounded-lg border border-hairline p-4 md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`${id}-judul`} className="!text-[19px] font-semibold text-ink">
            {item.name}
          </h3>
          <p className="text-[13px] text-muted">
            {CATEGORY_LABEL[item.category]} · {item.kabupaten} · dikirim {formatWibDateTime(item.createdAt)}
          </p>
        </div>
      </header>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Detail label="Alamat">{item.address}</Detail>
        <Detail label="Koordinat">
          {item.lat.toFixed(5)}, {item.lon.toFixed(5)}{" "}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[14px] underline">
            buka di Google Maps
          </a>
        </Detail>
        <Detail label="Jam buka">{summarizeOpenHours(item.openHours)}</Detail>
        <Detail label="Dalam ruangan">{item.isIndoor ? "Ya" : "Tidak"}</Detail>
        <Detail label="Pengelola">
          {item.managerName} ({MANAGER_ROLE_LABEL[item.managerRole]})
        </Detail>
        <Detail label="Kontak WhatsApp">
          {item.contactWa ? (
            <a href={`https://wa.me/${item.contactWa}`} target="_blank" rel="noopener noreferrer" className="underline">
              +{item.contactWa}
            </a>
          ) : (
            "—"
          )}
        </Detail>
        <Detail label="Akun pengusul">{item.submitterEmail ?? "—"}</Detail>
        <Detail label="Tautan bukti">
          {item.evidenceUrl ? (
            <a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer" className="break-all underline">
              {item.evidenceUrl}
            </a>
          ) : (
            "—"
          )}
        </Detail>
        {item.description && (
          <div className="sm:col-span-2">
            <Detail label="Deskripsi">{item.description}</Detail>
          </div>
        )}
      </dl>

      <section aria-label="Kandidat duplikat" className="mt-4 rounded-md bg-surface-soft p-3">
        <p className="text-sm font-medium text-ink">Destinasi yang sudah ada dalam radius 500 m</p>
        {item.nearby.length === 0 ? (
          <p className="text-sm text-muted">Tidak ada. Kecil kemungkinan duplikat.</p>
        ) : (
          <ul className="mt-1 text-sm text-body">
            {item.nearby.map((near) => (
              <li key={near.slug}>
                <Link href={`/destinasi/${near.slug}`} target="_blank" className="underline">
                  {near.name}
                </Link>{" "}
                ({near.distanceM} m)
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={approve} className="mt-5 flex flex-col gap-4 border-t border-hairline pt-5">
        <h4 className="font-serif text-[18px] text-ink">Setujui dan tayangkan</h4>
        <input type="hidden" name="submissionId" value={item.id} />

        <div>
          <label htmlFor={`${id}-slug`} className="text-sm font-medium text-ink">
            Slug (alamat halaman)
          </label>
          <input id={`${id}-slug`} name="slug" required maxLength={80} defaultValue={item.suggestedSlug} className={`${INPUT} mt-1 font-mono text-[15px]`} />
        </div>

        <div>
          <label htmlFor={`${id}-wilayah`} className="text-sm font-medium text-ink">
            Wilayah cuaca BMKG
          </label>
          <p className="mt-0.5 text-[13px] text-muted">
            {item.suggestedRegion
              ? `Disarankan: ${item.suggestedRegion.desa}, ${item.suggestedRegion.kecamatan} (milik destinasi terdekat, ±${item.suggestedRegion.distanceM} m). Pastikan sesuai lokasi sebenarnya.`
              : "Tidak ada saran. Pilih wilayah yang paling dekat."}
          </p>
          <select
            id={`${id}-wilayah`}
            name="adm4Code"
            required
            defaultValue={item.suggestedRegion?.adm4Code ?? ""}
            className={`${INPUT} mt-1`}
          >
            <option value="" disabled>
              Pilih wilayah
            </option>
            {reference.regions.map((region) => (
              <option key={region.adm4Code} value={region.adm4Code}>
                {region.desa}, {region.kecamatan}, {region.kabupaten}
              </option>
            ))}
          </select>
        </div>

        {item.category === "pantai" && (
          <div>
            <label htmlFor={`${id}-laut`} className="text-sm font-medium text-ink">
              Wilayah perairan BMKG
            </label>
            <p className="mt-0.5 text-[13px] text-muted">
              {item.suggestedMarineArea
                ? `Disarankan ${item.suggestedMarineArea} (dari pantai terdekat dalam 5 km).`
                : "Tidak ada pantai lain dalam 5 km. Kosongkan bila ragu: badge laut akan menampilkan data belum tersedia."}
            </p>
            <select id={`${id}-laut`} name="marineAreaCode" defaultValue={item.suggestedMarineArea ?? ""} className={`${INPUT} mt-1`}>
              <option value="">Tanpa data laut</option>
              {reference.marineAreas.map((area) => (
                <option key={area.code} value={area.code}>
                  {area.code} · {area.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <input type="checkbox" name="isIndoor" defaultChecked={item.isIndoor} className="size-5 accent-primary" />
            Kegiatan utama di dalam ruangan
          </label>
          {item.openHours !== null && (
            <label className="flex min-h-11 items-start gap-3 text-sm text-ink">
              <input type="checkbox" name="hoursVerified" className="mt-0.5 size-5 shrink-0 accent-primary" />
              <span>
                Jam buka sudah saya konfirmasi ke pengelola. Hanya centang bila benar-benar sudah dihubungi; ini mengisi tanggal
                verifikasi di halaman destinasi.
              </span>
            </label>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-catatan`} className="text-sm font-medium text-ink">
            Catatan untuk pengusul (opsional)
          </label>
          <textarea id={`${id}-catatan`} name="note" rows={2} maxLength={500} className={`${INPUT} mt-1 py-2`} />
        </div>

        {approveState.error && (
          <p role="alert" className="rounded-md bg-score-bad-bg px-3 py-2 text-sm font-medium text-score-bad-text">
            {approveState.error}
          </p>
        )}
        <div>
          <button type="submit" disabled={approving || rejecting} className={buttonClass.primary}>
            {approving ? "Menyimpan…" : "Setujui dan tayangkan"}
          </button>
        </div>
      </form>

      <details className="mt-5 border-t border-hairline pt-4">
        <summary className="min-h-11 cursor-pointer py-2 text-[15px] font-semibold text-ink">Tolak usulan ini</summary>
        <form action={reject} className="mt-2 flex flex-col gap-3">
          <input type="hidden" name="submissionId" value={item.id} />
          <div>
            <label htmlFor={`${id}-alasan`} className="text-sm font-medium text-ink">
              Alasan penolakan (dibaca pengusul)
            </label>
            <textarea id={`${id}-alasan`} name="note" required minLength={5} maxLength={500} rows={2} className={`${INPUT} mt-1 py-2`} />
            <p className="mt-0.5 text-[13px] text-muted">Nomor WhatsApp pengusul otomatis dihapus saat usulan ditolak.</p>
          </div>
          {rejectState.error && (
            <p role="alert" className="rounded-md bg-score-bad-bg px-3 py-2 text-sm font-medium text-score-bad-text">
              {rejectState.error}
            </p>
          )}
          <div>
            <button type="submit" disabled={approving || rejecting} className={buttonClass.secondary}>
              {rejecting ? "Menyimpan…" : "Tolak usulan"}
            </button>
          </div>
        </form>
      </details>
    </article>
  );
}
