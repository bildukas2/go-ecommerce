import Link from "next/link";
import {
  getAdminNavigationLocations,
  getAdminNavigationMenuItems,
  getAdminNavigationMenus,
} from "@/lib/api";
import { NavigationMenusContent } from "@/components/admin/cms/navigation/navigation-menus-content";

export const dynamic = "force-dynamic";

export default async function AdminNavigationMenusPage() {
  const [{ menus }, { locations }] = await Promise.all([
    getAdminNavigationMenus(),
    getAdminNavigationLocations(),
  ]);

  const itemCounts = Object.fromEntries(
    await Promise.all(
      menus.map(async (menu) => {
        const { items } = await getAdminNavigationMenuItems(menu.id);
        return [menu.id, items.length] as const;
      }),
    ),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Navigation Menus</h1>
          <p className="text-sm text-foreground/60">Create menus and assign them to storefront locations.</p>
        </div>
        <Link
          href="/admin/cms/navigation/locations"
          className="inline-flex items-center rounded-xl border border-surface-border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
        >
          Manage Locations
        </Link>
      </div>

      <NavigationMenusContent initialMenus={menus} initialLocations={locations} initialItemCounts={itemCounts} />
    </div>
  );
}
