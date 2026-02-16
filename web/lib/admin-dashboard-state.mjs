import { isUnauthorizedAdminError } from "./admin-orders-state.mjs";

const EMPTY_DASHBOARD = Object.freeze({
  metrics: {
    total_orders: 0,
    pending_payment: 0,
    paid: 0,
    cancelled: 0,
  },
  recent_orders: [],
});

export function emptyDashboard() {
  return {
    metrics: { ...EMPTY_DASHBOARD.metrics },
    recent_orders: [],
  };
}

export function normalizeDashboardData(payload) {
  const source = isRecord(payload) ? payload : {};
  const metricsSource = isRecord(source.metrics) ? source.metrics : {};
  const recentOrdersSource = Array.isArray(source.recent_orders) ? source.recent_orders : [];

  return {
    metrics: {
      total_orders: toNonNegativeInt(metricsSource.total_orders),
      pending_payment: toNonNegativeInt(metricsSource.pending_payment),
      paid: toNonNegativeInt(metricsSource.paid),
      cancelled: toNonNegativeInt(metricsSource.cancelled),
    },
    recent_orders: recentOrdersSource.filter(isRecentOrderLike),
  };
}

export function resolveDashboardErrorMessage(error) {
  if (isUnauthorizedAdminError(error)) {
    return "Unauthorized. Check ADMIN_USER and ADMIN_PASS server credentials.";
  }
  return "Failed to load dashboard metrics. Please retry.";
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

function isRecord(value) {
  return typeof value === "object" && value !== null;
}
