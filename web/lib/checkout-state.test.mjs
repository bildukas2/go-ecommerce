import test from "node:test";
import assert from "node:assert/strict";
import { firstSearchParam, parseCheckoutResponse } from "./checkout-state.mjs";

test("parseCheckoutResponse returns validated payload", () => {
  const payload = {
    order_id: "ord_123",
    checkout_url: "https://checkout.example.com/session/abc",
    status: "pending_payment",
  };

  assert.deepEqual(parseCheckoutResponse(payload), payload);
});

test("parseCheckoutResponse throws on missing required keys", () => {
  assert.throws(
    () => parseCheckoutResponse({ order_id: "ord_123", status: "pending_payment" }),
    /Invalid checkout response payload/,
  );
});

test("firstSearchParam returns a single value from string or array", () => {
  assert.equal(firstSearchParam("ord_1"), "ord_1");
  assert.equal(firstSearchParam(["ord_2", "ord_3"]), "ord_2");
  assert.equal(firstSearchParam(undefined), undefined);
});
