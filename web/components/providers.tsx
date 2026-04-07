"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { CartProvider } from "@/components/cart-context";
import { ShopCurrencyProvider } from "@/components/shop-currency-context";

export function Providers({ children, shopCurrency = "USD" }: { children: React.ReactNode; shopCurrency?: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="volm-theme"
    >
      <HeroUIProvider>
        <ShopCurrencyProvider currency={shopCurrency}>
          <CartProvider>{children}</CartProvider>
        </ShopCurrencyProvider>
      </HeroUIProvider>
    </NextThemesProvider>
  );
}
