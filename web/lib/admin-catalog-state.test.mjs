import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAdminProductsState,
  calculateDiscountPreview,
  isEveryProductSelected,
  isUnauthorizedAdminError,
  normalizeSelectedProductIDs,
  parseAdminProductsSearchParams,
  parseDiscountDraft,
  toggleProductSelection,
} from "./admin-catalog-state.mjs";

test("parseAdminProductsSearchParams returns safe defaults", () => {
  assert.deepEqual(parseAdminProductsSearchParams(undefined), {
    page: 1,
    limit: 20,
    category: "",
    sort: "newest",
    stock: "all",
  });
});

test("parseAdminProductsSearchParams normalizes invalid values", () => {
  assert.deepEqual(
    parseAdminProductsSearchParams({
      page: "0",
      limit: "-9",
      category: "  home  ",
      sort: "bad",
      stock: "invalid",
    }),
    {
      page: 1,
      limit: 20,
      category: "home",
      sort: "newest",
      stock: "all",
    },
  );
});

test("parseAdminProductsSearchParams accepts string[] values", () => {
  assert.deepEqual(
    parseAdminProductsSearchParams({
      page: ["2", "4"],
      limit: ["30"],
      category: ["desk"],
      sort: ["name_asc"],
      stock: ["in_stock"],
    }),
    {
      page: 2,
      limit: 30,
      category: "desk",
      sort: "name_asc",
      stock: "in_stock",
    },
  );
});

test("applyAdminProductsState filters low stock and sorts by price", () => {
  const products = [
    { title: "A", createdAt: "2026-01-01T00:00:00Z", variants: [{ stock: 1, priceCents: 900 }] },
    { title: "B", createdAt: "2026-01-02T00:00:00Z", variants: [{ stock: 6, priceCents: 700 }] },
    { title: "C", createdAt: "2026-01-03T00:00:00Z", variants: [{ stock: 2, priceCents: 300 }] },
  ];

  const result = applyAdminProductsState(products, { sort: "price_asc", stock: "low_stock" });
  assert.deepEqual(result.map((item) => item.title), ["C", "A"]);
});

test("isUnauthorizedAdminError detects 401 responses", () => {
  assert.equal(isUnauthorizedAdminError(new Error("Failed to fetch products: 401")), true);
  assert.equal(isUnauthorizedAdminError(new Error("Failed to fetch products: 500")), false);
  assert.equal(isUnauthorizedAdminError({ message: "401" }), false);
});

test("normalizeSelectedProductIDs trims and deduplicates ids", () => {
  assert.deepEqual(normalizeSelectedProductIDs([" a ", "b", "a", "", "   "]), ["a", "b"]);
});

test("toggleProductSelection adds and removes ids safely", () => {
  const added = toggleProductSelection(["a"], "b", true);
  assert.deepEqual(added, ["a", "b"]);

  const removed = toggleProductSelection(["a", "b"], "a", false);
  assert.deepEqual(removed, ["b"]);
});

test("isEveryProductSelected returns true only when all ids are present", () => {
  assert.equal(isEveryProductSelected(["p1", "p2"], ["p2", "p1", "p1"]), true);
  assert.equal(isEveryProductSelected(["p1", "p2"], ["p1"]), false);
});

test("parseDiscountDraft normalizes discount mode and numeric value", () => {
  assert.deepEqual(parseDiscountDraft("price", "1299.2"), { mode: "price", value: 1299.2 });
  assert.deepEqual(parseDiscountDraft("wat", "abc"), { mode: "percent", value: 0 });
});

test("calculateDiscountPreview computes valid percent discounts", () => {
  assert.deepEqual(calculateDiscountPreview(1000, "percent", 25), {
    valid: true,
    discountedPriceCents: 750,
    savingsCents: 250,
    percentOff: 25,
  });
});

test("calculateDiscountPreview rejects invalid static prices", () => {
  assert.deepEqual(calculateDiscountPreview(1000, "price", 1000), {
    valid: false,
    discountedPriceCents: null,
    savingsCents: null,
    percentOff: null,
  });
});
