import type { DashboardResponse } from "./api";

export function emptyDashboard(): DashboardResponse;
export function normalizeDashboardData(payload: unknown): DashboardResponse;
export function resolveDashboardErrorMessage(error: unknown): string;
export function shouldUseMockDashboard(envValue: unknown): boolean;
