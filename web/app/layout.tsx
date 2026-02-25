import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { StorefrontHeader } from "@/components/storefront-header";
import { StorefrontFooter } from "@/components/storefront-footer";
import { getCurrentAccount, getStorefrontNavigationLocation } from "@/lib/api";
import type { StorefrontNavigationItem } from "@/lib/api";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Go Ecommerce",
  description: "Demo storefront",
};

export default async function RootLayout({
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`} suppressHydrationWarning>
        <Providers>
          <StorefrontHeader isAuthenticated={isAuthenticated} mobileItems={mobileItems} />
          <div className="flex-grow">
            {children}
          </div>
          <StorefrontFooter shopItems={footerShopItems} infoItems={footerInfoItems} />
        </Providers>
      </body>
    </html>
  );
}
