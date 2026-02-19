"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { loginAccount, registerAccount } from "@/lib/api";

type AuthMode = "login" | "register";

type AccountAuthFormProps = {
  mode: AuthMode;
  nextPath?: string;
};

const modeLabel: Record<AuthMode, string> = {
  login: "Login",
  register: "Create account",
};

export function AccountAuthForm({ mode, nextPath = "/account" }: AccountAuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
      const message = err instanceof Error ? err.message : `${modeLabel[mode]} failed`;
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-surface-border bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-surface-border bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
        />
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Please wait..." : modeLabel[mode]}
      </Button>
    </form>
  );
}
