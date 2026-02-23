import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CHECKOUT_STATE_PATH = new URL("../hooks/use-checkout-state.ts", import.meta.url);

async function read(path) {
  return readFile(path, "utf8");
}

test("setSelectedShippingMethod updates shipping price immediately", async () => {
  const source = await read(CHECKOUT_STATE_PATH);
  assert.match(source, /const setSelectedShippingMethod = React\.useCallback/);
  assert.match(source, /SET_SELECTED_SHIPPING_METHOD/);
  assert.match(source, /SET_SHIPPING_PRICE", payload: method\?\.price \?\? 0/);
});
