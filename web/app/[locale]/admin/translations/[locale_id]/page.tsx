import { getAdminTranslationDetail } from "@/lib/api";
import { TranslationEditor } from "@/components/admin/translation-editor";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface TranslationEditPageProps {
  params: Promise<{
    locale: string;
    locale_id: string;
  }>;
}

export default async function AdminTranslationEditPage({ params }: TranslationEditPageProps) {
  const { locale_id } = await params;

  let initialData: Record<string, any> | null = null;
  try {
    initialData = await getAdminTranslationDetail(locale_id);
  } catch (error) {
    console.error(`Failed to load translation for ${locale_id}:`, error);
    notFound();
  }

  if (!initialData) {
    notFound();
  }

  return <TranslationEditor locale={locale_id} initialData={initialData} />;
}
