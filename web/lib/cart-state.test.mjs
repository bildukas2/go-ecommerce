import test from "node:test";
import assert from "node:assert/strict";
import { optimisticRemoveItem, optimisticUpdateQuantity } from "./cart-state.mjs";

function makeCart() {
  return {
    ID: "cart-1",
    Items: [
      {
        ID: "item-1",
        CartID: "cart-1",
        ProductVariantID: "variant-1",
        UnitPriceCents: 1200,
        Currency: "EUR",
        Quantity: 1,
      },
      {
        ID: "item-2",
        CartID: "cart-1",
        ProductVariantID: "variant-2",
        UnitPriceCents: 2500,
        Currency: "EUR",
        Quantity: 2,
      },
    ],
    Totals: {
      SubtotalCents: 6200,
      Currency: "EUR",
      ItemCount: 3,
    },
  };
}

test("optimisticUpdateQuantity recalculates subtotal and item count", () => {
  const updated = optimisticUpdateQuantity(makeCart(), "item-2", 3);
  assert.equal(updated.Items.find((item) => item.ID === "item-2")?.Quantity, 3);
  assert.equal(updated.Totals.ItemCount, 4);
  assert.equal(updated.Totals.SubtotalCents, 8700);
});

test("optimisticRemoveItem removes item and recalculates totals", () => {
  const updated = optimisticRemoveItem(makeCart(), "item-1");
  assert.equal(updated.Items.some((item) => item.ID === "item-1"), false);
  assert.equal(updated.Totals.ItemCount, 2);
  assert.equal(updated.Totals.SubtotalCents, 5000);
});
