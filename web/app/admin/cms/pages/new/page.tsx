import { createAdminPage } from "@/lib/api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PageForm } from "@/components/admin/cms/page-form";

export default function NewAdminPage() {
  async function createPageAction(formData: FormData) {
    "use server";
    
    let slug = formData.get("slug") as string;
    if (slug && !slug.startsWith("/")) slug = "/" + slug;
    
    const payload = {
      title: formData.get("title") as string,
      slug,
      status: formData.get("status") as "draft" | "published",
      content_html: formData.get("content_html") as string,
      editor_mode: formData.get("editor_mode") as "html" | "visual",
      meta_title: (formData.get("meta_title") as string) || undefined,
      meta_description: (formData.get("meta_description") as string) || undefined,
    };

    try {
      await createAdminPage(payload);
      revalidatePath("/admin/cms/pages");
    } catch (error) {
      console.error("Failed to create page:", error);
      return;
    }

    redirect(`/admin/cms/pages`);
  }

  return <PageForm onSubmit={createPageAction} />;
}
