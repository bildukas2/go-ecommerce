"use client";

import { useState } from "react";
import { updateAdminEmailTemplate, type EmailTemplate } from "@/lib/api";
import { useTranslations } from "next-intl";

type Props = {
  initialTemplate: EmailTemplate;
};

export function EmailTemplateEditor({ initialTemplate }: Props) {
  const t = useTranslations("admin.email");
  const common = useTranslations("common.buttons");
  const [subjectEN, setSubjectEN] = useState(initialTemplate.subject_i18n.en ?? "");
  const [subjectLT, setSubjectLT] = useState(initialTemplate.subject_i18n.lt ?? "");
  const [bodyEN, setBodyEN] = useState(initialTemplate.body_html_i18n.en ?? "");
  const [bodyLT, setBodyLT] = useState(initialTemplate.body_html_i18n.lt ?? "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function copyENtoLT() {
    setSubjectLT(subjectEN);
    setBodyLT(bodyEN);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");

    try {
      const updated = await updateAdminEmailTemplate(initialTemplate.code, {
        subject_i18n: { en: subjectEN, lt: subjectLT },
        body_html_i18n: { en: bodyEN, lt: bodyLT },
      });
      setSubjectEN(updated.subject_i18n.en ?? "");
      setSubjectLT(updated.subject_i18n.lt ?? "");
      setBodyEN(updated.body_html_i18n.en ?? "");
      setBodyLT(updated.body_html_i18n.lt ?? "");
      setSuccess(t("messages.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.save_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-5">
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t("template_editor.title")}</h2>
        <button
          type="button"
          onClick={copyENtoLT}
          className="rounded-lg border border-surface-border bg-foreground/[0.02] px-3 py-1.5 text-sm hover:bg-foreground/[0.05]"
        >
          {common("copy_en_to_lt")}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-surface-border p-4">
          <h3 className="text-sm font-semibold">{t("template_editor.english")}</h3>
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">{t("template_editor.subject")}</span>
            <input
              value={subjectEN}
              onChange={(e) => setSubjectEN(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">{t("template_editor.body_html")}</span>
            <textarea
              value={bodyEN}
              onChange={(e) => setBodyEN(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 font-mono text-xs"
            />
          </label>
        </section>

        <section className="space-y-3 rounded-xl border border-surface-border p-4">
          <h3 className="text-sm font-semibold">{t("template_editor.lithuanian")}</h3>
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">{t("template_editor.subject")}</span>
            <input
              value={subjectLT}
              onChange={(e) => setSubjectLT(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">{t("template_editor.body_html")}</span>
            <textarea
              value={bodyLT}
              onChange={(e) => setBodyLT(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 font-mono text-xs"
            />
          </label>
        </section>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-500/18 disabled:opacity-60 dark:text-blue-300"
        >
          {saving ? t("template_editor.saving") : common("save")}
        </button>
      </div>
    </form>
  );
}
