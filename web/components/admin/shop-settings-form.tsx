"use client";

import { useState } from "react";
import { updateAdminShopSettings, type ShopSettings } from "@/lib/api";
import { useTranslations } from "next-intl";

type Props = {
  initialSettings: ShopSettings;
};

const CURRENCIES = ["USD", "EUR", "GBP", "PLN", "SEK", "NOK", "DKK", "CHF", "CAD", "AUD", "JPY"] as const;

export function ShopSettingsForm({ initialSettings }: Props) {
  const t = useTranslations("admin.shop");
  const common = useTranslations("common.buttons");
  const [currency, setCurrency] = useState(initialSettings.currency || "USD");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      const updated = await updateAdminShopSettings({ currency });
      setCurrency(updated.currency);
      setSuccess(t("messages.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.save_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-surface-border p-4">
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <label className="space-y-1 text-sm">
        <span className="text-foreground/70">{t("currency_label")}</span>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 md:w-64"
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-500/18 disabled:opacity-60 dark:text-blue-300"
        >
          {saving ? t("saving") : common("save")}
        </button>
      </div>
    </form>
  );
}
