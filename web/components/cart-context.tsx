"use client";

import * as React from "react";
import { addCartItem, checkout as apiCheckout, ensureCart, getCart, removeCartItem, updateCartItem, type Cart } from "@/lib/api";
import { optimisticRemoveItem, optimisticUpdateQuantity } from "@/lib/cart-state";

type CartState = {
  open: boolean;
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  mutatingItemIds: string[];
};

type CartContextType = CartState & {
  openDrawer: () => void;
  closeDrawer: () => void;
  refresh: () => Promise<void>;
  add: (variantId: string, quantity?: number) => Promise<void>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  checkout: () => Promise<{ order_id: string; checkout_url: string; status: string }>;
};

const CartContext = React.createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<CartState>({ open: false, cart: null, loading: false, error: null, mutatingItemIds: [] });

  const refresh = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await ensureCart();
      const c = await getCart();
      setState((s) => ({ ...s, cart: c, loading: false }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load cart";
      setState((s) => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  React.useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const openDrawer = React.useCallback(() => {
    setState((s) => ({ ...s, open: true }));
    refresh().catch(() => undefined);
  }, [refresh]);
  const closeDrawer = React.useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const add = React.useCallback(async (variantId: string, quantity = 1) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await ensureCart();
      const c = await addCartItem(variantId, quantity);
      setState((s) => ({ ...s, cart: c, loading: false, open: true }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add item";
      setState((s) => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  const update = React.useCallback(async (itemId: string, quantity: number) => {
    setState((s) => {
      if (!s.cart) return { ...s };
      const optimistic: Cart = optimisticUpdateQuantity(s.cart, itemId, quantity);
      const mutatingItemIds = s.mutatingItemIds.includes(itemId) ? s.mutatingItemIds : [...s.mutatingItemIds, itemId];
      return { ...s, cart: optimistic, error: null, mutatingItemIds };
    });
    try {
      const c = await updateCartItem(itemId, quantity);
      setState((s) => ({ ...s, cart: c, error: null, mutatingItemIds: s.mutatingItemIds.filter((id) => id !== itemId) }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update item";
      setState((s) => ({ ...s, error: msg, mutatingItemIds: s.mutatingItemIds.filter((id) => id !== itemId) }));
      await refresh();
    }
  }, [refresh]);

  const remove = React.useCallback(async (itemId: string) => {
    setState((s) => {
      if (!s.cart) return { ...s };
      const optimistic: Cart = optimisticRemoveItem(s.cart, itemId);
      const mutatingItemIds = s.mutatingItemIds.includes(itemId) ? s.mutatingItemIds : [...s.mutatingItemIds, itemId];
      return { ...s, cart: optimistic, error: null, mutatingItemIds };
    });
    try {
      const c = await removeCartItem(itemId);
      setState((s) => ({ ...s, cart: c, error: null, mutatingItemIds: s.mutatingItemIds.filter((id) => id !== itemId) }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to remove item";
      setState((s) => ({ ...s, error: msg, mutatingItemIds: s.mutatingItemIds.filter((id) => id !== itemId) }));
      await refresh();
    }
  }, [refresh]);

  const checkout = React.useCallback(async () => {
    const res = await apiCheckout();
    return res;
  }, []);

  const value: CartContextType = React.useMemo(() => ({
    ...state,
    openDrawer,
    closeDrawer,
    refresh,
    add,
    update,
    remove,
    checkout,
  }), [state, openDrawer, closeDrawer, refresh, add, update, remove, checkout]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("CartProvider missing");
  return ctx;
}
