import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ApiError, withApi } from "@/lib/api/errors";
import { noStoreJson, parseJsonBody } from "@/lib/api/http";
import { enforceWriteLimit } from "@/lib/api/rate-limit";
import { getPageUser } from "@/lib/auth/session";
import { getDestinationBySlug } from "@/lib/db/destinations";
import { addTripItem, createTrip } from "@/lib/trips/service";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  title: z.string().trim().min(1, "Judul rencana tidak boleh kosong").max(80, "Judul maksimal 80 karakter"),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  items: z.array(
    z.object({
      slug: z.string().min(1),
      part: z.enum(["pagi", "siang", "sore", "malam"]),
    }),
  ).min(1, "Minimal 1 destinasi dalam rencana"),
});

// Jam target WIB untuk tiap bagian
const PART_HOUR_WIB: Record<"pagi" | "siang" | "sore" | "malam", number> = {
  pagi: 9,
  siang: 12,
  sore: 15,
  malam: 19,
};

// POST /api/v1/assistant/save-itinerary
// Menyimpan rencana yang disusun oleh Wistara AI ke tabel `trips` dan `trip_items` pengguna yang sedang login
export const POST = withApi(async (request) => {
  const user = await getPageUser();
  if (!user) {
    throw new ApiError("UNAUTHORIZED", "Silakan masuk atau daftar akun terlebih dahulu untuk menyimpan rencana.");
  }

  const { title, dayKey, items } = await parseJsonBody(saveSchema, request);

  // Periksa rate limit penulisan
  await enforceWriteLimit(user.id);

  // Buat rencana baru
  const trip = await createTrip(user.id, title);

  // Masukkan tiap destinasi sesuai slot waktunya
  for (const item of items) {
    const dest = await getDestinationBySlug(item.slug);
    if (!dest) continue;

    const hourWib = PART_HOUR_WIB[item.part] || 9;
    // Format WIB ISO: YYYY-MM-DDTHH:00:00+07:00 -> Date
    const hourPad = hourWib.toString().padStart(2, "0");
    const slotDate = new Date(`${dayKey}T${hourPad}:00:00+07:00`);

    await addTripItem(user.id, trip.id, dest.id, slotDate);
  }

  revalidatePath("/rencana");

  return noStoreJson({
    success: true,
    tripId: trip.id,
    message: "Rencana perjalanan berhasil disimpan!",
  });
});
