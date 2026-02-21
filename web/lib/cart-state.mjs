function cartItems(cart) {
  return Array.isArray(cart?.Items) ? cart.Items : [];
}

export function recalculateTotals(cart) {
  const items = cartItems(cart);
  const itemCount = items.reduce((sum, item) => sum + item.Quantity, 0);
  const subtotalCents = items.reduce((sum, item) => sum + item.UnitPriceCents * item.Quantity, 0);
  return {
    ...cart,
    Items: items,
    Totals: {
      ...cart.Totals,
      ItemCount: itemCount,
      SubtotalCents: subtotalCents,
    },
  };
}

export function optimisticUpdateQuantity(cart, itemId, quantity) {
  const items = cartItems(cart);
  const updated = {
    ...cart,
    Items: items.map((item) => (item.ID === itemId ? { ...item, Quantity: quantity } : item)),
  };
  return recalculateTotals(updated);
}

export function optimisticRemoveItem(cart, itemId) {
  const items = cartItems(cart);
  const updated = {
    ...cart,
    Items: items.filter((item) => item.ID !== itemId),
  };
  return recalculateTotals(updated);
}
