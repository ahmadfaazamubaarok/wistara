"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { enforceSubmissionLimit, enforceWriteLimit } from "@/lib/api/rate-limit";
import { getPageUser } from "@/lib/auth/session";
import { fieldErrorsFrom, rawFromFormData, submissionSchema } from "@/lib/submissions/schema";
import {
  approvalSchema,
  approveSubmission,
  createSubmission,
  deleteMySubmission,
  isAdmin,
  rejectionNoteSchema,
  rejectSubmission,
} from "@/lib/submissions/service";

export type SubmissionFormState = {
  /** Galat umum (bukan milik satu kolom), mis. batas laju atau usulan ganda. */
  error?: string;
  /** Satu pesan per kolom, ditampilkan di samping isian. */
  fieldErrors?: Record<string, string>;
  /** Terisi setelah berhasil; formulir lalu dikosongkan oleh komponen. */
  success?: { name: string };
};

export type ReviewActionState = { error?: string; done?: boolean };

const uuid = z.uuid();

/** Server Action wajib memeriksa pengguna sendiri; proxy bukan pagar akses. */
async function requireLogin(returnTo: string) {
  const user = await getPageUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Hanya admin. Non-admin mendapat 404 agar keberadaan panel tidak terbuka. */
async function requireAdminUser() {
  const user = await requireLogin("/admin/usulan");
  if (!(await isAdmin(user.id))) notFound();
  return user;
}

export async function createSubmissionAction(
  _previous: SubmissionFormState,
  formData: FormData,
): Promise<SubmissionFormState> {
  const user = await requireLogin("/usul");

  const parsed = submissionSchema.safeParse(rawFromFormData(formData));
  if (!parsed.success) {
    return { error: "Periksa kembali isian yang ditandai.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await enforceSubmissionLimit(user.id);
    await createSubmission(user.id, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error; // galat tak terduga ditangani error.tsx dan dicatat di server
  }
  revalidatePath("/usul");
  return { success: { name: parsed.data.name } };
}

export async function deleteSubmissionAction(formData: FormData) {
  const user = await requireLogin("/usul");
  const id = uuid.safeParse(formData.get("submissionId"));
  if (!id.success) return;
  try {
    await enforceWriteLimit(user.id);
    await deleteMySubmission(user.id, id.data);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error; // sudah ditinjau / terhapus: tidak ada yang perlu ditampilkan
  }
  revalidatePath("/usul");
}

export async function approveSubmissionAction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const admin = await requireAdminUser();
  const id = uuid.safeParse(formData.get("submissionId"));
  if (!id.success) return { error: "Usulan tidak valid" };

  const marine = String(formData.get("marineAreaCode") ?? "");
  const note = String(formData.get("note") ?? "");
  const parsed = approvalSchema.safeParse({
    slug: formData.get("slug") ?? undefined,
    adm4Code: formData.get("adm4Code") ?? undefined,
    marineAreaCode: marine === "" ? null : marine,
    isIndoor: formData.get("isIndoor") === "on",
    hoursVerified: formData.get("hoursVerified") === "on",
    note: note.trim() === "" ? null : note,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Isian tidak valid" };

  try {
    await enforceWriteLimit(admin.id);
    await approveSubmission(admin.id, id.data, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/usulan");
  revalidatePath("/");
  return { done: true };
}

export async function rejectSubmissionAction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const admin = await requireAdminUser();
  const id = uuid.safeParse(formData.get("submissionId"));
  if (!id.success) return { error: "Usulan tidak valid" };

  const note = rejectionNoteSchema.safeParse(formData.get("note") ?? undefined);
  if (!note.success) return { error: note.error.issues[0]?.message ?? "Alasan tidak valid" };

  try {
    await enforceWriteLimit(admin.id);
    await rejectSubmission(admin.id, id.data, note.data);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/usulan");
  return { done: true };
}
