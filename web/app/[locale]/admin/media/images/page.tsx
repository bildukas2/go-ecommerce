import { getAdminMedia } from "@/lib/api";
import { ImagesManager } from "@/components/admin/media/images-manager";

export const dynamic = "force-dynamic";

export default async function AdminMediaImagesPage() {
  let items: Awaited<ReturnType<typeof getAdminMedia>>["items"] = [];
  let total = 0;
  const pageSize = 100;

  try {
    const res = await getAdminMedia({ limit: pageSize, offset: 0, media_type: "image" });
    items = res.items;
    total = res.items.length;
  } catch {
    // show empty state
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Images</h1>
        <p className="text-sm text-foreground/70">Upload, browse, and manage all images in your media library.</p>
      </div>
      <ImagesManager initialItems={items} initialTotal={total} pageSize={pageSize} />
    </div>
  );
}
