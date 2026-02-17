import test from "node:test";
import assert from "node:assert/strict";
import { selectProductGridImage } from "./product-images.mjs";

test("selectProductGridImage returns explicit default image when present", () => {
  const selected = selectProductGridImage([
    { id: "img-1", url: "https://images.example.com/first.jpg", isDefault: false },
    { id: "img-2", url: "https://images.example.com/default.jpg", isDefault: true },
  ]);

  assert.equal(selected, "https://images.example.com/default.jpg");
});

test("selectProductGridImage falls back to first image when no default exists", () => {
  const selected = selectProductGridImage([
    { id: "img-1", url: "https://images.example.com/first.jpg", isDefault: false },
    { id: "img-2", url: "https://images.example.com/second.jpg", isDefault: false },
  ]);

  assert.equal(selected, "https://images.example.com/first.jpg");
});

test("selectProductGridImage returns null for empty image lists", () => {
  assert.equal(selectProductGridImage([]), null);
});
