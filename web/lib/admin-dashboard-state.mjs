import { isUnauthorizedAdminError } from "./admin-orders-state.mjs";

const EMPTY_DASHBOARD = Object.freeze({
  metrics: {
    total_orders: 0,
    pending_payment: 0,
    paid: 0,
    processing: 0,
    completed: 0,
    cancelled: 0,
  },
  recent_orders: [],
  revenue_trend: [],
  top_products: [],
});

export function emptyDashboard() {
  return {
    metrics: { ...EMPTY_DASHBOARD.metrics },
    recent_orders: [],
    revenue_trend: [],
    top_products: [],
  };
}

export function normalizeDashboardData(payload) {
  const source = isRecord(payload) ? payload : {};
  const metricsSource = isRecord(source.metrics) ? source.metrics : {};
  const recentOrdersSource = Array.isArray(source.recent_orders) ? source.recent_orders : [];
  const revenueTrendSource = Array.isArray(source.revenue_trend) ? source.revenue_trend : [];
  const topProductsSource = Array.isArray(source.top_products) ? source.top_products : [];

  return {
    metrics: {
      total_orders: toNonNegativeInt(metricsSource.total_orders),
      pending_payment: toNonNegativeInt(metricsSource.pending_payment),
      paid: toNonNegativeInt(metricsSource.paid),
      processing: toNonNegativeInt(metricsSource.processing),
      completed: toNonNegativeInt(metricsSource.completed),
      cancelled: toNonNegativeInt(metricsSource.cancelled),
    },
    recent_orders: recentOrdersSource.filter(isRecentOrderLike),
    revenue_trend: revenueTrendSource.filter(isTrendPointLike),
    top_products: topProductsSource.filter(isTopProductLike),
  };
}

export function resolveDashboardErrorMessage(error) {
  if (isUnauthorizedAdminError(error)) {
    return "Unauthorized. Please sign in again.";
  }
  return "Failed to load dashboard metrics. Please retry.";
}

export function shouldUseMockDashboard(envValue) {
  if (typeof envValue !== "string") return false;
  const normalized = envValue.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "on") {
    return true;
  }
  return false;
}

function toNonNegativeInt(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function isRecentOrderLike(value) {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.number === "string" &&
    typeof value.status === "string" &&
    Number.isFinite(Number(value.total_cents)) &&
    typeof value.currency === "string" &&
    typeof value.created_at === "string"
  );
}

function isTrendPointLike(value) {
  return (
    isRecord(value) &&
    typeof value.date === "string" &&
    Number.isFinite(Number(value.total_cents)) &&
    Number.isFinite(Number(value.order_count))
  );
}

function isTopProductLike(value) {
  return (
    isRecord(value) &&
    typeof value.product_title === "string" &&
    typeof value.sku === "string" &&
    Number.isFinite(Number(value.total_sold)) &&
    Number.isFinite(Number(value.total_revenue))
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}
