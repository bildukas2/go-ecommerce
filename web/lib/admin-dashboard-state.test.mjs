import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyDashboard,
  normalizeDashboardData,
  resolveDashboardErrorMessage,
  shouldUseMockDashboard,
} from "./admin-dashboard-state.mjs";

test("emptyDashboard returns zeroed metrics and no recent orders", () => {
  assert.deepEqual(emptyDashboard(), {
    backend_version: "0.5.0",
    web_version: "0.5.0",
    metrics: {
      total_orders: 0,
      pending_payment: 0,
      paid: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
      predicted_revenue: 0,
      real_revenue: 0,
    },
    recent_orders: [],
    revenue_trend: [],
    top_products: [],
  });
});

test("normalizeDashboardData sanitizes invalid payload and keeps valid recent orders", () => {
  const parsed = normalizeDashboardData({
    backend_version: "0.5.1",
    web_version: "0.6.0",
    metrics: {
      total_orders: "12",
      pending_payment: -2,
      paid: "bad",
      cancelled: 1,
    },
    recent_orders: [
      {
        id: "o_1",
        number: "ORD-0001",
        status: "paid",
        total_cents: 1299,
        currency: "usd",
        created_at: "2026-02-15T00:00:00Z",
      },
      { id: "invalid" },
    ],
  });

  assert.deepEqual(parsed, {
    backend_version: "0.5.1",
    web_version: "0.6.0",
    metrics: {
      total_orders: 12,
      pending_payment: 0,
      paid: 0,
      processing: 0,
      completed: 0,
      cancelled: 1,
      predicted_revenue: 0,
      real_revenue: 0,
    },
    recent_orders: [
      {
        id: "o_1",
        number: "ORD-0001",
        status: "paid",
        total_cents: 1299,
        currency: "usd",
        created_at: "2026-02-15T00:00:00Z",
      },
    ],
    revenue_trend: [],
    top_products: [],
  });
});

test("resolveDashboardErrorMessage handles unauthorized and generic failures", () => {
  assert.equal(
    resolveDashboardErrorMessage(new Error("Failed to fetch dashboard: 401")),
    "Unauthorized. Please sign in again."
  );
  assert.equal(
    resolveDashboardErrorMessage(new Error("Failed to fetch dashboard: 500")),
    "Failed to load dashboard metrics. Please retry."
  );
});

test("shouldUseMockDashboard defaults to false and supports explicit on values", () => {
  assert.equal(shouldUseMockDashboard(undefined), false);
  assert.equal(shouldUseMockDashboard(""), false);
  assert.equal(shouldUseMockDashboard("true"), true);
  assert.equal(shouldUseMockDashboard(" 1 "), true);
  assert.equal(shouldUseMockDashboard("false"), false);
  assert.equal(shouldUseMockDashboard("0"), false);
  assert.equal(shouldUseMockDashboard("off"), false);
});
