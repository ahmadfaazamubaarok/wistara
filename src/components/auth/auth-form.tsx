"use client";

import { useActionState } from "react";
import { signInAction, signUpAction, type AuthFormState } from "@/app/actions/auth";
import { buttonClass } from "@/components/ui";

const FIELD =
  "min-h-11 w-full rounded-md border border-border-input bg-canvas px-3 text-base text-ink placeholder:text-muted";

export function AuthForm({ mode, next }: { mode: "masuk" | "daftar"; next: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === "masuk" ? signInAction : signUpAction,
    {},
  );
  const isLogin = mode === "masuk";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          placeholder="nama@contoh.com"
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Kata sandi
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete={isLogin ? "current-password" : "new-password"}
          aria-describedby={isLogin ? undefined : "password-bantuan"}
          className={FIELD}
        />
        {!isLogin && (
          <p id="password-bantuan" className="text-[13px] text-muted">
            Minimal 8 karakter.
          </p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-score-bad-bg px-3 py-2 text-sm font-medium text-score-bad-text">
          {state.error}
        </p>
      )}
      {state.info && (
        <p role="status" className="rounded-md bg-score-good-bg px-3 py-2 text-sm font-medium text-score-good-text">
          {state.info}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${buttonClass.primary} disabled:bg-primary-disabled disabled:text-muted`}>
        {pending ? "Memproses…" : isLogin ? "Masuk" : "Buat akun"}
      </button>
    </form>
  );
}
