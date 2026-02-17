import Link from "next/link";
import { getDashboard } from "@/lib/api";
import { DashboardMetrics } from "@/components/admin/dashboard-metrics";
import { RecentOrdersTable } from "@/components/admin/recent-orders-table";
import { Button } from "@/components/ui/button";
import {
  ADMIN_DASHBOARD_MOCK,
  ADMIN_DASHBOARD_MOCK_TOP_PRODUCTS,
  ADMIN_DASHBOARD_MOCK_TREND,
} from "@/lib/admin-dashboard-mock";
import {
  emptyDashboard,
  normalizeDashboardData,
  resolveDashboardErrorMessage,
  shouldUseMockDashboard,
} from "@/lib/admin-dashboard-state";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const useMockDashboard = shouldUseMockDashboard(process.env.ADMIN_DASHBOARD_USE_MOCK);
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  if (!useMockDashboard && (!user || !pass)) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <h1 className="mb-2 text-2xl font-semibold md:text-3xl">Admin Not Configured</h1>
        <p className="text-sm text-muted-foreground">
          Set ADMIN_USER and ADMIN_PASS on the server, then reload this page.
        </p>
      </div>
    );
  }

  let fetchError: string | null = null;
  let dashboard = emptyDashboard();

  if (useMockDashboard) {
    dashboard = normalizeDashboardData(ADMIN_DASHBOARD_MOCK);
  } else {
    try {
      dashboard = normalizeDashboardData(await getDashboard());
    } catch (error) {
      fetchError = resolveDashboardErrorMessage(error);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-foreground/70">
            Overview of your store&apos;s performance and recent activity
            {useMockDashboard ? " with mock preview data." : "."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {useMockDashboard && (
            <span className="rounded-full border border-blue-500/30 bg-blue-500/12 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
              Preview Mode
            </span>
          )}
          <Button asChild variant="outline">
            <Link href="/admin/orders">View All Orders</Link>
          </Button>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      <DashboardMetrics metrics={dashboard.metrics} />

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <section className="glass rounded-2xl border p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Weekly revenue trend</h2>
            <p className="text-sm text-foreground/65">Orders and revenue preview over the last 7 days.</p>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {ADMIN_DASHBOARD_MOCK_TREND.map((point) => (
              <div key={point.label} className="rounded-xl bg-foreground/[0.03] p-2 text-center">
                <div className="mb-2 flex h-20 items-end justify-center">
                  <div
                    className="w-5 rounded-md bg-gradient-to-t from-blue-500/35 to-cyan-400/75"
                    style={{
                      height: `${Math.max(
                        16,
                        Math.round((point.revenue_cents / 365100) * 80),
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs font-medium">{point.label}</p>
                <p className="text-[11px] text-foreground/65">{point.orders} orders</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl border p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Top products</h2>
            <p className="text-sm text-foreground/65">Best-selling items in this preview.</p>
          </div>
          <div className="space-y-3">
            {ADMIN_DASHBOARD_MOCK_TOP_PRODUCTS.map((product) => (
              <div key={product.id} className="rounded-xl bg-foreground/[0.03] p-3">
                <p className="text-sm font-medium">{product.name}</p>
                <div className="mt-1 flex items-center justify-between text-xs text-foreground/65">
                  <span>{product.units} units</span>
                  <span>
                    {(product.revenue_cents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <RecentOrdersTable orders={dashboard.recent_orders} />
    </div>
  );
}
