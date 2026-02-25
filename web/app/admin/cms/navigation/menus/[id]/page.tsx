import { notFound } from "next/navigation";
import { getAdminCategories, getAdminNavigationMenuItems, getAdminNavigationMenus, getAdminPages } from "@/lib/api";
import { NavigationMenuDetailContent } from "@/components/admin/cms/navigation/navigation-menu-detail-content";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminNavigationMenuDetailPage({ params }: Props) {
  const { id } = await params;
  const [{ menus }, { items }, { pages }, { items: categories }] = await Promise.all([
    getAdminNavigationMenus(),
    getAdminNavigationMenuItems(id),
    getAdminPages({ limit: 200 }),
    getAdminCategories(),
  ]);

  const menu = menus.find((candidate) => candidate.id === id);
  if (!menu) notFound();

  return (
    <NavigationMenuDetailContent
      menu={menu}
      initialItems={items}
      pages={pages}
      categories={categories}
    />
  );
}
