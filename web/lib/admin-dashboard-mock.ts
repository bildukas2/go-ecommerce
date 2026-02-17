import type { DashboardResponse } from "@/lib/api";

export type DashboardTrendPoint = {
  label: string;
  orders: number;
  revenue_cents: number;
};

export type DashboardTopProduct = {
  id: string;
  name: string;
  units: number;
  revenue_cents: number;
};

export const ADMIN_DASHBOARD_MOCK: DashboardResponse = {
  metrics: {
    total_orders: 1428,
    pending_payment: 37,
    paid: 1332,
    cancelled: 59,
  },
  recent_orders: [
    {
      id: "ord_01jz85r9gg0f7",
      number: "ORD-2026-1024",
      status: "paid",
      total_cents: 18990,
      currency: "usd",
      created_at: "2026-02-17T17:22:00Z",
    },
    {
      id: "ord_01jz84vq8j5t2",
      number: "ORD-2026-1023",
      status: "pending_payment",
      total_cents: 7999,
      currency: "usd",
      created_at: "2026-02-17T16:59:00Z",
    },
    {
      id: "ord_01jz84j5d13xq",
      number: "ORD-2026-1022",
      status: "paid",
      total_cents: 25900,
      currency: "usd",
      created_at: "2026-02-17T16:41:00Z",
    },
    {
      id: "ord_01jz83x4x7mr4",
      number: "ORD-2026-1021",
      status: "cancelled",
      total_cents: 5400,
      currency: "usd",
      created_at: "2026-02-17T16:05:00Z",
    },
    {
      id: "ord_01jz834h665j0",
      number: "ORD-2026-1020",
      status: "paid",
      total_cents: 11999,
      currency: "usd",
      created_at: "2026-02-17T15:49:00Z",
    },
  ],
};

export const ADMIN_DASHBOARD_MOCK_TREND: DashboardTrendPoint[] = [
  { label: "Mon", orders: 158, revenue_cents: 244000 },
  { label: "Tue", orders: 201, revenue_cents: 289500 },
  { label: "Wed", orders: 179, revenue_cents: 260900 },
  { label: "Thu", orders: 226, revenue_cents: 321400 },
  { label: "Fri", orders: 241, revenue_cents: 349800 },
  { label: "Sat", orders: 247, revenue_cents: 365100 },
  { label: "Sun", orders: 176, revenue_cents: 248200 },
];

export const ADMIN_DASHBOARD_MOCK_TOP_PRODUCTS: DashboardTopProduct[] = [
  { id: "p_hoodie_black", name: "Core Hoodie Black", units: 182, revenue_cents: 1455820 },
  { id: "p_cap_storm", name: "Storm Cap", units: 149, revenue_cents: 506600 },
  { id: "p_tee_oversized", name: "Oversized Tee", units: 133, revenue_cents: 878550 },
  { id: "p_jacket_city", name: "City Runner Jacket", units: 86, revenue_cents: 842800 },
];
