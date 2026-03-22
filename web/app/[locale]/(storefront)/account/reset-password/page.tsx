"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/lib/api";

export default function ResetPasswordPage() {
  const t = useTranslations("account.reset_password");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!token) {
    return (
      <div className="hero-aurora mx-auto max-w-md px-6 py-10">
        <div className="rounded-2xl border border-surface-border bg-surface/95 p-8 shadow-[0_18px_48px_rgba(2,6,23,0.14)] text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-4">{t("title")}</h1>
          <p className="text-foreground/70 mb-6">{t("invalid_link")}</p>
          <Link href="/account/forgot-password" className="font-medium text-blue-600 hover:underline">
            {t("go_to_login")}
          </Link>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="hero-aurora mx-auto max-w-md px-6 py-10">
        <div className="rounded-2xl border border-surface-border bg-surface/95 p-8 shadow-[0_18px_48px_rgba(2,6,23,0.14)] text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-4">{t("title")}</h1>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-6">{t("success")}</p>
          <Link href="/account/login" className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">
            {t("go_to_login")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-aurora mx-auto max-w-md px-6 py-10">
      <div className="rounded-2xl border border-surface-border bg-surface/95 p-8 shadow-[0_18px_48px_rgba(2,6,23,0.14)]">
        <h1 className="text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-foreground/70">{t("subtitle")}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-base font-medium text-foreground">
              {t("new_password")}
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("new_password_placeholder")}
              className="h-12 w-full rounded-xl border border-surface-border bg-background/80 px-4 text-base text-foreground outline-none transition focus:border-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-xl bg-blue-600 text-base font-semibold text-white hover:bg-blue-700"
          >
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
