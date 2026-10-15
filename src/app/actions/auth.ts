"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; info?: string };

const credentials = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email wajib diisi")
    .max(254, "Email terlalu panjang")
    .pipe(z.email("Format email tidak valid")),
  // Batas atas 72 = batas bcrypt: kata sandi lebih panjang akan dipotong diam-diam oleh penyimpan hash.
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(72, "Kata sandi maksimal 72 karakter"),
});

function readCredentials(formData: FormData) {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  return parsed.success ? { ok: true as const, ...parsed.data } : { ok: false as const, error: parsed.error.issues[0].message };
}

const UNAVAILABLE = "Layanan login belum tersedia atau sedang bermasalah. Coba lagi sebentar lagi.";

export async function signInAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const input = readCredentials(formData);
  if (!input.ok) return { error: input.error };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: UNAVAILABLE };

  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) {
    // Pesan sama untuk email tidak ada dan kata sandi salah: tidak membocorkan akun mana yang terdaftar.
    return { error: error.status && error.status < 500 ? "Email atau kata sandi salah." : UNAVAILABLE };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const input = readCredentials(formData);
  if (!input.ok) return { error: input.error };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: UNAVAILABLE };

  const { data, error } = await supabase.auth.signUp({ email: input.email, password: input.password });
  if (error) {
    if (error.status === 422 || /already/i.test(error.message)) {
      return { error: "Email ini sudah terdaftar. Silakan masuk." };
    }
    return { error: error.status && error.status < 500 ? error.message : UNAVAILABLE };
  }
  // Konfirmasi email aktif (produksi): belum ada sesi sampai tautan di email dibuka.
  if (!data.session) {
    return { info: "Kami mengirim email konfirmasi. Buka tautannya, lalu masuk dengan email dan kata sandi tadi." };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/");
}
