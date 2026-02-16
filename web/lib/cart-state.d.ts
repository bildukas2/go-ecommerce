import type { Cart } from "./api";

export function recalculateTotals(cart: Cart): Cart;
export function optimisticUpdateQuantity(cart: Cart, itemId: string, quantity: number): Cart;
export function optimisticRemoveItem(cart: Cart, itemId: string): Cart;
