import { getAdminEmailTemplate } from "@/lib/api";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { EmailTemplateEditor } from "@/components/admin/email/email-template-editor";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ code: string }>;
};

export default async function AdminEmailTemplatePage({ params }: Props) {
  const { code } = await params;
  const t = await getTranslations("admin.email");

  let template;
  try {
    template = await getAdminEmailTemplate(code);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("404") || message.includes("not found")) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{template.name}</h1>
          <p className="font-mono text-sm text-foreground/70">{template.code}</p>
        </div>
        <Link
          href="/admin/email/templates"
          className="rounded-lg border border-surface-border bg-foreground/[0.02] px-3 py-1.5 text-sm hover:bg-foreground/[0.05]"
        >
          {t("template_page.back")}
        </Link>
      </div>

      <div className="rounded-2xl border border-surface-border p-6">
        <EmailTemplateEditor initialTemplate={template} />
      </div>
    </div>
  );
}
