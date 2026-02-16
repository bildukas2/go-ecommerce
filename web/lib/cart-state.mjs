export function recalculateTotals(cart) {
  const itemCount = cart.Items.reduce((sum, item) => sum + item.Quantity, 0);
  const subtotalCents = cart.Items.reduce((sum, item) => sum + item.UnitPriceCents * item.Quantity, 0);
  return {
    ...cart,
    Totals: {
      ...cart.Totals,
      ItemCount: itemCount,
      SubtotalCents: subtotalCents,
    },
  };
}

export function optimisticUpdateQuantity(cart, itemId, quantity) {
  const updated = {
    ...cart,
    Items: cart.Items.map((item) => (item.ID === itemId ? { ...item, Quantity: quantity } : item)),
  };
  return recalculateTotals(updated);
}

export function optimisticRemoveItem(cart, itemId) {
  const updated = {
    ...cart,
    Items: cart.Items.filter((item) => item.ID !== itemId),
  };
  return recalculateTotals(updated);
}
