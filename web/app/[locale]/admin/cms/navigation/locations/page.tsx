import Link from "next/link";
import { getAdminNavigationLocations, getAdminNavigationMenus } from "@/lib/api";
import { NavigationLocationsContent } from "@/components/admin/cms/navigation/navigation-locations-content";

export const dynamic = "force-dynamic";

export default async function AdminNavigationLocationsPage() {
  const [{ locations }, { menus }] = await Promise.all([
    getAdminNavigationLocations(),
    getAdminNavigationMenus(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Navigation Locations</h1>
          <p className="text-sm text-foreground/60">Assign menus to theme locations like header, footer, and mobile.</p>
        </div>
        <Link
          href="/admin/cms/navigation/menus"
          className="inline-flex items-center rounded-xl border border-surface-border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
        >
          Back to Menus
        </Link>
      </div>

      <NavigationLocationsContent initialLocations={locations} menus={menus} />
    </div>
  );
}
