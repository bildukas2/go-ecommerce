"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { getAccountProfile, updateAccountProfile, type CustomerProfile } from "@/lib/api";

export function ProfileForm() {
  const t = useTranslations("account.profile");
  const [profile, setProfile] = React.useState<CustomerProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getAccountProfile()
      .then(setProfile)
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  function update(field: keyof CustomerProfile, value: string | boolean) {
    setProfile((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || submitting) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateAccountProfile(profile);
      setProfile(updated);
      setMessage(t("saved"));
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-surface-border bg-surface p-5 text-sm text-neutral-500">Loading...</div>;
  }

  if (!profile) {
    return error ? (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-600 dark:text-red-400">{error}</div>
    ) : null;
  }

  const inputCls = "w-full rounded-xl border border-surface-border bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-neutral-500";
  const labelCls = "text-sm font-medium";

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-surface-border bg-surface p-5">
      {/* Personal info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className={labelCls}>{t("first_name")}</label>
          <input className={inputCls} value={profile.first_name} onChange={(e) => update("first_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className={labelCls}>{t("last_name")}</label>
          <input className={inputCls} value={profile.last_name} onChange={(e) => update("last_name", e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <label className={labelCls}>{t("phone")}</label>
        <input className={inputCls} value={profile.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+370 600 00000" />
      </div>

      {/* Shipping address */}
      <div className="border-t border-surface-border pt-5">
        <h3 className="mb-4 font-semibold">{t("shipping_title")}</h3>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelCls}>{t("full_name")}</label>
              <input className={inputCls} value={profile.shipping_full_name} onChange={(e) => update("shipping_full_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>{t("phone")}</label>
              <input className={inputCls} value={profile.shipping_phone} onChange={(e) => update("shipping_phone", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>{t("address")}</label>
            <input className={inputCls} value={profile.shipping_address1} onChange={(e) => update("shipping_address1", e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>{t("apartment")}</label>
            <input className={inputCls} value={profile.shipping_address2} onChange={(e) => update("shipping_address2", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className={labelCls}>{t("city")}</label>
              <input className={inputCls} value={profile.shipping_city} onChange={(e) => update("shipping_city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>{t("postcode")}</label>
              <input className={inputCls} value={profile.shipping_postcode} onChange={(e) => update("shipping_postcode", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>{t("country")}</label>
              <select className={inputCls} value={profile.shipping_country} onChange={(e) => update("shipping_country", e.target.value)}>
                <option value="">—</option>
                <option value="LT">Lithuania</option>
                <option value="LV">Latvia</option>
                <option value="EE">Estonia</option>
                <option value="FI">Finland</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Company info */}
      <div className="border-t border-surface-border pt-5">
        <h3 className="mb-4 font-semibold">{t("company_title")}</h3>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelCls}>{t("company_name")}</label>
              <input className={inputCls} value={profile.company_name} onChange={(e) => update("company_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>{t("vat_number")}</label>
              <input className={inputCls} value={profile.company_vat} onChange={(e) => update("company_vat", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>{t("invoice_email")}</label>
            <input className={inputCls} type="email" value={profile.invoice_email} onChange={(e) => update("invoice_email", e.target.value)} />
          </div>
        </div>
      </div>

      {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
