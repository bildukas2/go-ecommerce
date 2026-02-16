import test from "node:test";
import assert from "node:assert/strict";
import { isNotFoundAdminError, isUnauthorizedAdminError, parsePositiveIntParam } from "./admin-orders-state.mjs";

test("parsePositiveIntParam returns fallback when param is missing or invalid", () => {
  assert.equal(parsePositiveIntParam(undefined, 1), 1);
  assert.equal(parsePositiveIntParam("0", 20), 20);
  assert.equal(parsePositiveIntParam("-2", 5), 5);
  assert.equal(parsePositiveIntParam("abc", 7), 7);
});

test("parsePositiveIntParam accepts string and string[] values", () => {
  assert.equal(parsePositiveIntParam("3", 1), 3);
  assert.equal(parsePositiveIntParam(["4", "6"], 1), 4);
});

test("isUnauthorizedAdminError detects 401 responses", () => {
  assert.equal(isUnauthorizedAdminError(new Error("Failed to fetch orders: 401")), true);
  assert.equal(isUnauthorizedAdminError(new Error("Failed to fetch orders: 500")), false);
  assert.equal(isUnauthorizedAdminError({ message: "401" }), false);
});

test("isNotFoundAdminError detects 404 responses", () => {
  assert.equal(isNotFoundAdminError(new Error("Failed to fetch order: 404")), true);
  assert.equal(isNotFoundAdminError(new Error("Failed to fetch order: 401")), false);
  assert.equal(isNotFoundAdminError({ message: "404" }), false);
});
