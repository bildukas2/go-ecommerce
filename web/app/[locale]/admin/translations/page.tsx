import { getAdminTranslations } from "@/lib/api";
import { TranslationsTable } from "@/components/admin/translations-table";
import { Globe } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminTranslationsPage() {
  let locales: string[] = [];
  let fetchError: string | null = null;

  try {
    const response = await getAdminTranslations();
    locales = response.items;
  } catch (error) {
    console.error("Failed to load translations:", error);
    fetchError = "Failed to load translations. Please check if the backend is running and you have proper permissions.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Globe size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Translations</h1>
            <p className="text-foreground/70">Manage your store&apos;s language files and localization</p>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-2xl border border-red-200/50 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {fetchError}
        </div>
      )}

      <TranslationsTable locales={locales} />
    </div>
  );
}
