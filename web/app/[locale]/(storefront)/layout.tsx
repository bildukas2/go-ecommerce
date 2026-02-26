import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import { StorefrontHeader } from "@/components/storefront-header";
import { StorefrontFooter } from "@/components/storefront-footer";
import { getCurrentAccount, getStorefrontNavigationLocation } from "@/lib/api";
import type { StorefrontNavigationItem } from "@/lib/api";

export default async function StorefrontLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let isAuthenticated = false;
  let footerShopItems: StorefrontNavigationItem[] = [];
  let footerInfoItems: StorefrontNavigationItem[] = [];
  let mobileItems: StorefrontNavigationItem[] = [];
  try {
    const cookieHeader = (await cookies()).toString();
    await getCurrentAccount({ cookieHeader });
    isAuthenticated = true;
  } catch {}
  try {
    const [footerShop, footerInfo, mobile] = await Promise.all([
      getStorefrontNavigationLocation("footer_shop"),
      getStorefrontNavigationLocation("footer_info"),
      getStorefrontNavigationLocation("mobile"),
    ]);
    footerShopItems = footerShop?.menu?.items ?? [];
    footerInfoItems = footerInfo?.menu?.items ?? [];
    mobileItems = mobile?.menu?.items ?? [];
  } catch {}

  return (
    <Providers>
      <StorefrontHeader isAuthenticated={isAuthenticated} mobileItems={mobileItems} />
      <main className="flex-grow">
        {children}
      </main>
      <StorefrontFooter shopItems={footerShopItems} infoItems={footerInfoItems} />
    </Providers>
  );
}
