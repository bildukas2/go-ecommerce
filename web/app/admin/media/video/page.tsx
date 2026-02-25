import { getAdminMedia } from "@/lib/api";
import { VideoManager } from "@/components/admin/media/video-manager";

export const dynamic = "force-dynamic";

export default async function AdminMediaVideoPage() {
  let items: Awaited<ReturnType<typeof getAdminMedia>>["items"] = [];

  try {
    const res = await getAdminMedia({ limit: 100, offset: 0, media_type: "video" });
    items = res.items;
  } catch {
    // show empty state
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Video</h1>
        <p className="text-sm text-foreground/70">Upload, browse, and manage all videos in your media library.</p>
      </div>
      <VideoManager initialItems={items} />
    </div>
  );
}
