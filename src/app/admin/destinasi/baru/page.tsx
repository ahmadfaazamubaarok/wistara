import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { DestinationForm } from "@/components/admin/destination-form";
import { SiteFooter } from "@/components/site-footer";
import { getPageUser } from "@/lib/auth/session";
import { getReviewReference, isAdmin } from "@/lib/submissions/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tambah Destinasi Baru",
  robots: { index: false },
};

export default async function TambahDestinasiPage() {
  const user = await getPageUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent("/admin/destinasi/baru")}`);
  if (!(await isAdmin(user.id))) notFound();

  const reference = await getReviewReference(user.id);

  return (
    <>
      <main id="konten" className="mx-auto w-full max-w-[860px] flex-1 px-4 py-8 md:px-8 md:py-10">
        <AdminNav />
        <h1>Tambah Destinasi Baru</h1>
        <p className="mt-2 text-sm text-muted">
          Tambahkan destinasi wisata baru secara langsung ke katalog Wistara DIY.
        </p>

        <DestinationForm regions={reference.regions} marineAreas={reference.marineAreas} />
      </main>
      <SiteFooter />
    </>
  );
}
