"use client";

import { useState } from "react";
import { sendAdminEmailTest, updateAdminEmailSettings, type EmailSettings, type UpdateEmailSettingsInput } from "@/lib/api";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type Props = {
  initialSettings: EmailSettings;
};

export function EmailSettingsForm({ initialSettings }: Props) {
  const t = useTranslations("admin.email");
  const common = useTranslations("common.buttons");
  const [form, setForm] = useState<UpdateEmailSettingsInput>({
    driver: initialSettings.driver,
    smtp_host: initialSettings.smtp_host,
    smtp_port: initialSettings.smtp_port,
    smtp_username: initialSettings.smtp_username,
    smtp_password: initialSettings.smtp_password,
    from_name: initialSettings.from_name,
    from_email: initialSettings.from_email,
  });
  const [testTo, setTestTo] = useState(initialSettings.from_email || "");
  const [testLang, setTestLang] = useState<"en" | "lt">("en");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const isSMTP = form.driver === "smtp";

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updateAdminEmailSettings(form);
      setForm({
        driver: updated.driver,
        smtp_host: updated.smtp_host,
        smtp_port: updated.smtp_port,
        smtp_username: updated.smtp_username,
        smtp_password: updated.smtp_password,
        from_name: updated.from_name,
        from_email: updated.from_email,
      });
      setSuccess(t("messages.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.save_error"));
    } finally {
      setSaving(false);
    }
  }

  async function onSendTest() {
    setTesting(true);
    setError("");
    setSuccess("");
    try {
      await sendAdminEmailTest(testTo, testLang);
      setSuccess(t("messages.test_sent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.test_error"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t("settings.title")}</h2>
          <p className="text-sm text-foreground/70">{t("settings.description")}</p>
        </div>
        <Link
          href="/admin/email/templates"
          className="rounded-lg border border-surface-border bg-foreground/[0.02] px-3 py-1.5 text-sm hover:bg-foreground/[0.05]"
        >
          {t("settings.manage_templates")}
        </Link>
      </div>

      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form className="space-y-4" onSubmit={onSave}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">{t("settings.driver")}</span>
            <select
              value={form.driver}
              onChange={(e) => setForm((prev) => ({ ...prev, driver: e.target.value as "mailpit" | "smtp" }))}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            >
              <option value="mailpit">{t("settings.driver_mailpit")}</option>
              <option value="smtp">{t("settings.driver_smtp")}</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">{t("settings.from_name")}</span>
            <input
              value={form.from_name}
              onChange={(e) => setForm((prev) => ({ ...prev, from_name: e.target.value }))}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-foreground/70">{t("settings.from_email")}</span>
            <input
              type="email"
              value={form.from_email}
              onChange={(e) => setForm((prev) => ({ ...prev, from_email: e.target.value }))}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>
        </div>

        {isSMTP && (
          <div className="grid gap-4 rounded-xl border border-surface-border p-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-foreground/70">{t("settings.smtp_host")}</span>
              <input
                value={form.smtp_host}
                onChange={(e) => setForm((prev) => ({ ...prev, smtp_host: e.target.value }))}
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-foreground/70">{t("settings.smtp_port")}</span>
              <input
                type="number"
                value={form.smtp_port}
                onChange={(e) => setForm((prev) => ({ ...prev, smtp_port: Number(e.target.value) || 0 }))}
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-foreground/70">{t("settings.smtp_username")}</span>
              <input
                value={form.smtp_username}
                onChange={(e) => setForm((prev) => ({ ...prev, smtp_username: e.target.value }))}
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-foreground/70">{t("settings.smtp_password")}</span>
              <input
                type="password"
                value={form.smtp_password}
                onChange={(e) => setForm((prev) => ({ ...prev, smtp_password: e.target.value }))}
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              />
            </label>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-500/18 disabled:opacity-60 dark:text-blue-300"
          >
            {saving ? t("settings.saving") : common("save")}
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-surface-border p-4">
        <h3 className="text-sm font-semibold">{t("test.title")}</h3>
        <p className="mt-1 text-sm text-foreground/70">{t("test.description")}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">{t("test.to")}</span>
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">{t("test.lang")}</span>
            <select
              value={testLang}
              onChange={(e) => setTestLang(e.target.value as "en" | "lt")}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            >
              <option value="en">EN</option>
              <option value="lt">LT</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onSendTest}
            disabled={testing}
            className="mt-6 rounded-lg border border-cyan-500/35 bg-cyan-500/12 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-500/18 disabled:opacity-60 dark:text-cyan-300"
          >
            {testing ? t("test.sending") : t("test.send")}
          </button>
        </div>
      </section>
    </div>
  );
}
