"use client";

import * as React from "react";

const ShopCurrencyContext = React.createContext<string>("USD");

export function ShopCurrencyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  return (
    <ShopCurrencyContext.Provider value={currency || "USD"}>
      {children}
    </ShopCurrencyContext.Provider>
  );
}

export function useShopCurrency(): string {
  return React.useContext(ShopCurrencyContext);
}
