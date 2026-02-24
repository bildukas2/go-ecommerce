import { getAdminNavigation, getAdminPages } from "@/lib/api";
import { CMSNavigationContent } from "./cms-navigation-content";

export const dynamic = "force-dynamic";

export default async function AdminNavigationPage() {
  const { items } = await getAdminNavigation();
  const { pages } = await getAdminPages({ limit: 100 }); // Assuming not too many pages for dropdown

  return <CMSNavigationContent initialItems={items} pages={pages} />;
}
