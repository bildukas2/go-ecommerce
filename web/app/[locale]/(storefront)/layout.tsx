import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import { ui } from "@/core/ui";
import { getCurrentAccount, getStorefrontNavigationLocation, getStorefrontShopSettings } from "@/lib/api";
import type { StorefrontNavigationItem } from "@/lib/api";

const StorefrontHeader = ui("StorefrontHeader");
const StorefrontFooter = ui("StorefrontFooter");

export default async function StorefrontLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  let isAuthenticated = false;
  let footerShopItems: StorefrontNavigationItem[] = [];
  let footerInfoItems: StorefrontNavigationItem[] = [];
  let mobileItems: StorefrontNavigationItem[] = [];
  let shopCurrency = "USD";
  try {
    const cookieHeader = (await cookies()).toString();
    await getCurrentAccount({ cookieHeader });
    isAuthenticated = true;
  } catch {}
  try {
    const [footerShop, footerInfo, mobile] = await Promise.all([
      getStorefrontNavigationLocation("footer_shop", locale),
      getStorefrontNavigationLocation("footer_info", locale),
      getStorefrontNavigationLocation("mobile", locale),
    ]);
    footerShopItems = footerShop?.menu?.items ?? [];
    footerInfoItems = footerInfo?.menu?.items ?? [];
    mobileItems = mobile?.menu?.items ?? [];
  } catch {}
  try {
    const settings = await getStorefrontShopSettings();
    if (settings.currency) {
      shopCurrency = settings.currency;
    }
  } catch {}

  return (
    <Providers shopCurrency={shopCurrency}>
      <StorefrontHeader isAuthenticated={isAuthenticated} mobileItems={mobileItems} />
      <main className="flex-grow">
        {children}
      </main>
      <StorefrontFooter shopItems={footerShopItems} infoItems={footerInfoItems} />
    </Providers>
  );
}
