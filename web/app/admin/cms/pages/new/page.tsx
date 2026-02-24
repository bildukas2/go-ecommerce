import { createAdminPage } from "@/lib/api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PageForm } from "@/components/admin/cms/page-form";

export default function NewAdminPage() {
  async function createPageAction(formData: FormData) {
    "use server";
    
    const payload = {
      title: formData.get("title") as string,
      slug: formData.get("slug") as string,
      status: formData.get("status") as "draft" | "published",
      content_html: formData.get("content_html") as string,
      editor_mode: formData.get("editor_mode") as "html" | "visual",
      meta_title: (formData.get("meta_title") as string) || undefined,
      meta_description: (formData.get("meta_description") as string) || undefined,
    };

    try {
      const page = await createAdminPage(payload);
      revalidatePath("/admin/cms/pages");
      redirect(`/admin/cms/pages`);
    } catch (error) {
      console.error("Failed to create page:", error);
      // Handle error state if needed
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageForm onSubmit={createPageAction} />
    </div>
  );
}
