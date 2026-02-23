import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ORDER_SUMMARY_PATH = new URL("../components/checkout/order-summary.tsx", import.meta.url);

async function read(path) {
  return readFile(path, "utf8");
}

test("OrderSummary renders cart custom options in item rows", async () => {
  const source = await read(ORDER_SUMMARY_PATH);
  assert.match(source, /item\.CustomOptions/);
  assert.match(source, /option\.Title/);
  assert.match(source, /customOptionLabel\(option\)/);
});

test("OrderSummary custom option label includes fallback to Selected", async () => {
  const source = await read(ORDER_SUMMARY_PATH);
  assert.match(source, /option\.ValueTitle/);
  assert.match(source, /option\.ValueTitles/);
  assert.match(source, /option\.ValueText/);
  assert.match(source, /return "Selected";/);
});
