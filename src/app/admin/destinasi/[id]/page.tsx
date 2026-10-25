import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { DeleteDestinationButton } from "@/components/admin/delete-destination-button";
import { DestinationForm } from "@/components/admin/destination-form";
import { SiteFooter } from "@/components/site-footer";
import { getAdminDestinationById } from "@/lib/admin/destinations";
import { getPageUser } from "@/lib/auth/session";
import { getReviewReference, isAdmin } from "@/lib/submissions/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit Destinasi",
  robots: { index: false },
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditDestinasiPage({ params }: Props) {
  const user = await getPageUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent("/admin/destinasi")}`);
  if (!(await isAdmin(user.id))) notFound();

  const { id } = await params;
  const [destination, reference] = await Promise.all([
    getAdminDestinationById(user.id, id),
    getReviewReference(user.id),
  ]);

  if (!destination) notFound();

  return (
    <>
      <main id="konten" className="mx-auto w-full max-w-[860px] flex-1 px-4 py-8 md:px-8 md:py-10">
        <AdminNav />

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1>Edit Destinasi</h1>
            <p className="mt-1 text-sm text-muted">
              Mengubah data untuk &ldquo;{destination.name}&rdquo; ({destination.slug}).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DeleteDestinationButton id={destination.id} name={destination.name} />
          </div>
        </div>

        <DestinationForm
          initialData={destination}
          regions={reference.regions}
          marineAreas={reference.marineAreas}
        />
      </main>
      <SiteFooter />
    </>
  );
}
