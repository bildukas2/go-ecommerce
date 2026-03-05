import { getAdminShopSettings } from "@/lib/api";
import { ShopSettingsForm } from "@/components/admin/shop-settings-form";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

async function fetchSettings() {
  try {
    const settings = await getAdminShopSettings();
    return { settings, error: "" };
  } catch (error) {
    return {
      settings: null,
      error: error instanceof Error ? error.message : "Failed to load shop settings",
    };
  }
}

export default async function ShopSettingsPage() {
  const t = await getTranslations("admin.shop");
  const { settings, error } = await fetchSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
        <p className="text-foreground/70">{t("page.description")}</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200/50 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {settings && <ShopSettingsForm initialSettings={settings} />}
    </div>
  );
}
