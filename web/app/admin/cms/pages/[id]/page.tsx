import { getAdminPage, updateAdminPage } from "@/lib/api";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { PageForm } from "@/components/admin/cms/page-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAdminPage({ params }: Props) {
  const { id } = await params;
  
  let page;
  try {
    page = await getAdminPage(id);
  } catch (error) {
    notFound();
  }

  async function updatePageAction(formData: FormData) {
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
      await updateAdminPage(id, payload);
      revalidatePath("/admin/cms/pages");
      revalidatePath(`/admin/cms/pages/${id}`);
    } catch (error) {
      console.error("Failed to update page:", error);
      return;
    }

    redirect(`/admin/cms/pages`);
  }

  return (
    <PageForm 
      initialData={page} 
      onSubmit={updatePageAction} 
    />
  );
}
