"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { enforceWriteLimit } from "@/lib/api/rate-limit";
import { tripBody } from "@/lib/api/schemas";
import { getPageUser } from "@/lib/auth/session";
import { addTripItem, createTrip, deleteTrip, deleteTripItem } from "@/lib/trips/service";

export type TripFormState = { error?: string };

const uuid = z.uuid();

/** Server Action wajib memeriksa pengguna sendiri; proxy bukan pagar akses. */
async function requireLogin(returnTo: string) {
  const user = await getPageUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Ubah galat layanan menjadi pesan untuk pengguna; galat tak terduga dilempar ulang ke error.tsx. */
function toState(error: unknown): TripFormState {
  if (error instanceof ApiError) return { error: error.message };
  throw error;
}

export async function createTripAction(_previous: TripFormState, formData: FormData): Promise<TripFormState> {
  const user = await requireLogin("/rencana");
  const parsed = tripBody.safeParse({ title: formData.get("title") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await enforceWriteLimit(user.id);
    await createTrip(user.id, parsed.data.title);
  } catch (error) {
    return toState(error);
  }
  revalidatePath("/rencana");
  return {};
}

export async function deleteTripAction(formData: FormData) {
  const user = await requireLogin("/rencana");
  const id = uuid.safeParse(formData.get("tripId"));
  if (!id.success) return;
  try {
    await enforceWriteLimit(user.id);
    await deleteTrip(user.id, id.data);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error; // sudah terhapus / dibatasi: tidak ada yang perlu ditampilkan
  }
  revalidatePath("/rencana");
}

export async function removeItemAction(formData: FormData) {
  const user = await requireLogin("/rencana");
  const tripId = uuid.safeParse(formData.get("tripId"));
  const itemId = uuid.safeParse(formData.get("itemId"));
  if (!tripId.success || !itemId.success) return;
  try {
    await enforceWriteLimit(user.id);
    await deleteTripItem(user.id, tripId.data, itemId.data);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  revalidatePath("/rencana");
}

const saveSchema = z.object({
  destinationId: z.uuid(),
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  tripId: z.union([z.literal("baru"), z.uuid()]),
  newTitle: z.string().trim().max(80, "Judul maksimal 80 karakter").optional(),
  plannedSlot: z.union([z.literal(""), z.iso.datetime({ offset: true })]).optional(),
});

export async function saveToTripAction(_previous: TripFormState, formData: FormData): Promise<TripFormState> {
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  const slug = typeof formData.get("slug") === "string" ? String(formData.get("slug")) : "";
  const returnTo = /^[a-z0-9-]{1,80}$/.test(slug) ? `/destinasi/${slug}` : "/";
  const user = await requireLogin(returnTo);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { destinationId, tripId, newTitle, plannedSlot } = parsed.data;

  try {
    await enforceWriteLimit(user.id);
    let targetTrip = tripId;
    if (tripId === "baru") {
      const title = newTitle?.trim();
      if (!title) return { error: "Isi judul untuk rencana baru, atau pilih rencana yang sudah ada." };
      targetTrip = (await createTrip(user.id, title)).id;
    }
    await addTripItem(user.id, targetTrip, destinationId, plannedSlot ? new Date(plannedSlot) : null);
  } catch (error) {
    return toState(error);
  }
  revalidatePath("/rencana");
  redirect("/rencana");
}
