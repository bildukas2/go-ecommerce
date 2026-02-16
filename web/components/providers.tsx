"use client";

import * as React from "react";
import { CartProvider } from "@/components/cart-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
