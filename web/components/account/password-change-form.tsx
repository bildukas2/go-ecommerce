"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { changeAccountPassword } from "@/lib/api";

export function PasswordChangeForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await changeAccountPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated. Please log in again.");
      router.push("/account/login?next=/account");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to change password";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-surface-border bg-surface p-5">
      <div className="space-y-2">
        <label htmlFor="current-password" className="text-sm font-medium">
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className="w-full rounded-xl border border-surface-border bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="new-password" className="text-sm font-medium">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="w-full rounded-xl border border-surface-border bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
        />
      </div>

      {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Updating..." : "Change password"}
      </Button>
    </form>
  );
}
