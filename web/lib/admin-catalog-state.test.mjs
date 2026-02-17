import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAdminProductsState,
  isUnauthorizedAdminError,
  parseAdminProductsSearchParams,
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
