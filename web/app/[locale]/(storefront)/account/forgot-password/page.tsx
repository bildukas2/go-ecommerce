"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const t = useTranslations("account.forgot_password");
  const locale = useLocale();
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email, locale);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="hero-aurora mx-auto max-w-md px-6 py-10">
      <div className="rounded-2xl border border-surface-border bg-surface/95 p-8 shadow-[0_18px_48px_rgba(2,6,23,0.14)]">
        <h1 className="text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-foreground/70">{t("subtitle")}</p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("success")}</p>
            <Link href="/account/login" className="text-sm font-medium text-blue-600 hover:underline">
              {t("back_to_login")}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-base font-medium text-foreground">
                {t("email")}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("email_placeholder")}
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

            <p className="text-center text-sm">
              <Link href="/account/login" className="font-medium text-blue-600 hover:underline">
                {t("back_to_login")}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
