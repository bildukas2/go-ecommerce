import { getAdminEmailSettings } from "@/lib/api";
import { EmailSettingsForm } from "@/components/admin/email/email-settings-form";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

async function fetchSettings() {
  try {
    const settings = await getAdminEmailSettings();
    return { settings, error: "" };
  } catch (error) {
    return {
      settings: null,
      error: error instanceof Error ? error.message : "Failed to load email settings",
    };
  }
}

export default async function AdminEmailSettingsPage() {
  const t = await getTranslations("admin.email");
  const { settings, error } = await fetchSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("settings_page.title")}</h1>
        <p className="text-foreground/70">{t("settings_page.description")}</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200/50 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {settings && (
        <div className="rounded-2xl border border-surface-border p-6">
          <EmailSettingsForm initialSettings={settings} />
        </div>
      )}
    </div>
  );
}
