"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isBlockedIPError, loginAccount, registerAccount } from "@/lib/api";

type AuthMode = "login" | "register";

type AccountAuthFormProps = {
  mode: AuthMode;
  nextPath?: string;
  uiVariant?: "default" | "hero";
};

const modeLabel: Record<AuthMode, string> = {
  login: "Log In",
  register: "Create account",
};

export function AccountAuthForm({ mode, nextPath = "/account", uiVariant = "default" }: AccountAuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isHero = uiVariant === "hero";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await loginAccount(email, password);
      } else {
        await registerAccount(email, password);
      }
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      if (isBlockedIPError(err)) {
        router.push(err.redirectTo);
        router.refresh();
        return;
      }
      const message = err instanceof Error ? err.message : `${modeLabel[mode]} failed`;
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={isHero ? "space-y-5" : "space-y-4"}>
      <div className="space-y-2">
        <label htmlFor="email" className={isHero ? "text-base font-medium text-foreground" : "text-sm font-medium text-neutral-700 dark:text-neutral-200"}>
          Email{isHero ? <span className="text-danger">*</span> : null}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          className={isHero
            ? "h-12 w-full rounded-xl border border-surface-border bg-background/80 px-4 text-base text-foreground outline-none transition focus:border-blue-500"
            : "w-full rounded-xl border border-surface-border bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className={isHero ? "text-base font-medium text-foreground" : "text-sm font-medium text-neutral-700 dark:text-neutral-200"}>
          Password{isHero ? <span className="text-danger">*</span> : null}
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className={isHero
              ? "h-12 w-full rounded-xl border border-surface-border bg-background/80 px-4 pr-11 text-base text-foreground outline-none transition focus:border-blue-500"
              : "w-full rounded-xl border border-surface-border bg-background/60 px-3 py-2 pr-10 text-sm outline-none transition focus:border-neutral-500"}
          />
          {isHero ? (
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground/70"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M2 12C3.73 8.11 7.52 5.5 12 5.5C16.48 5.5 20.27 8.11 22 12C20.27 15.89 16.48 18.5 12 18.5C7.52 18.5 3.73 15.89 2 12Z" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {isHero && mode === "login" ? (
        <div className="flex items-center justify-between pt-1 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-foreground/90">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="size-4 rounded border-surface-border accent-blue-600"
            />
            Remember me
          </label>
          <button type="button" className="text-foreground/60 hover:text-foreground/90">
            Forgot password?
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <Button type="submit" className={isHero ? "h-12 w-full rounded-xl bg-blue-600 text-base font-semibold text-white hover:bg-blue-700" : "w-full"} disabled={submitting}>
        {submitting ? "Please wait..." : modeLabel[mode]}
      </Button>
    </form>
  );
}
