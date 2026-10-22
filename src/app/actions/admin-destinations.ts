"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { getPageUser } from "@/lib/auth/session";
import {
  adminDestinationSchema,
  createAdminDestination,
  deleteAdminDestination,
  updateAdminDestination,
} from "@/lib/admin/destinations";
import { buildOpenHours } from "@/lib/submissions/schema";
import { isAdmin } from "@/lib/submissions/service";
import { slugify } from "@/lib/submissions/slug";

export type DestinationFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

async function requireAdminUser() {
  const user = await getPageUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent("/admin/destinasi")}`);
  if (!(await isAdmin(user.id))) notFound();
  return user;
}

function parseDestinationFormData(formData: FormData) {
  const text = (key: string) => {
    const val = formData.get(key);
    return typeof val === "string" ? val.trim() : "";
  };

  const name = text("name");
  let slug = text("slug");
  if (!slug && name) {
    slug = slugify(name);
  }

  const category = text("category");
  const isIndoor = formData.get("isIndoor") === "on";
  const adm4Code = text("adm4Code");
  const marineArea = text("marineAreaCode");
  const marineAreaCode = marineArea === "" ? null : marineArea;
  const latStr = text("lat");
  const lonStr = text("lon");
  const lat = Number(latStr.replace(",", "."));
  const lon = Number(lonStr.replace(",", "."));

  const openTime = text("openTime");
  const closeTime = text("closeTime");
  const closedDays = formData.getAll("closedDays").filter((v): v is string => typeof v === "string");
  const openHours = openTime && closeTime ? buildOpenHours(openTime, closeTime, closedDays) : null;

  const description = text("description") || null;
  const osmRef = text("osmRef") || null;
  const hoursVerified = formData.get("hoursVerified") === "on";

  return {
    raw: {
      name,
      slug,
      category,
      isIndoor,
      adm4Code,
      marineAreaCode,
      lat,
      lon,
      openHours,
      description,
      osmRef,
      hoursVerified,
    },
  };
}

export async function createDestinationAction(
  _previous: DestinationFormState,
  formData: FormData,
): Promise<DestinationFormState> {
  const admin = await requireAdminUser();
  const { raw } = parseDestinationFormData(formData);

  const parsed = adminDestinationSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { error: "Periksa kembali isian yang ditandai.", fieldErrors };
  }

  try {
    await createAdminDestination(admin.id, parsed.data);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }

  redirect("/admin/destinasi");
}

export async function updateDestinationAction(
  _previous: DestinationFormState,
  formData: FormData,
): Promise<DestinationFormState> {
  const admin = await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ID destinasi tidak ditemukan." };

  const { raw } = parseDestinationFormData(formData);
  const parsed = adminDestinationSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { error: "Periksa kembali isian yang ditandai.", fieldErrors };
  }

  try {
    await updateAdminDestination(admin.id, id, parsed.data);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }

  redirect("/admin/destinasi");
}

export async function deleteDestinationAction(formData: FormData) {
  const admin = await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  try {
    await deleteAdminDestination(admin.id, id);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  }

  redirect("/admin/destinasi");
}
