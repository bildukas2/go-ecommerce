import { listAdminEmailTemplates } from "@/lib/api";
import { EmailTemplatesList } from "@/components/admin/email/email-templates-list";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

async function fetchTemplates() {
  try {
    const items = await listAdminEmailTemplates();
    return { items, error: "" };
  } catch (error) {
    return {
      items: [],
      error: error instanceof Error ? error.message : "Failed to load email templates",
    };
  }
}

export default async function AdminEmailTemplatesPage() {
  const t = await getTranslations("admin.email");
  const { items, error } = await fetchTemplates();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("templates_page.title")}</h1>
        <p className="text-foreground/70">{t("templates_page.description")}</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200/50 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!error && <EmailTemplatesList templates={items} />}
    </div>
  );
}
