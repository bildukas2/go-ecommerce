import type { EmailTemplate } from "@/lib/api";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

type Props = {
  templates: EmailTemplate[];
};

function updatedLabel(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleString();
}

export function EmailTemplatesList({ templates }: Props) {
  const t = useTranslations("admin.email");

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-surface-border bg-background p-6 text-center text-sm text-foreground/70">
        {t("templates.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border bg-background">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-surface-border bg-foreground/[0.03] text-left">
          <tr>
            <th className="px-4 py-3 font-medium">{t("templates.name")}</th>
            <th className="px-4 py-3 font-medium">{t("templates.code")}</th>
            <th className="px-4 py-3 font-medium">{t("templates.updated_at")}</th>
            <th className="px-4 py-3 text-right font-medium">{t("templates.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id} className="border-b border-surface-border/60">
              <td className="px-4 py-3 font-medium">{template.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-foreground/75">{template.code}</td>
              <td className="px-4 py-3 text-foreground/75">{updatedLabel(template.updated_at)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/email/templates/${template.code}`}
                  className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-500/18 dark:text-blue-300"
                >
                  {t("templates.edit")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
