import Link from "next/link";
import { getDashboard } from "@/lib/api";
import { DashboardMetrics } from "@/components/admin/dashboard-metrics";
import { RecentOrdersTable } from "@/components/admin/recent-orders-table";
import { Button } from "@/components/ui/button";
import {
  emptyDashboard,
  normalizeDashboardData,
  resolveDashboardErrorMessage,
} from "@/lib/admin-dashboard-state";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  if (!user || !pass) {
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

  try {
    dashboard = normalizeDashboardData(await getDashboard());
  } catch (error) {
    fetchError = resolveDashboardErrorMessage(error);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your store&apos;s performance and recent activity.
          </p>
        </div>
        <div className="flex items-center gap-4">
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

      <RecentOrdersTable orders={dashboard.recent_orders} />
    </div>
  );
}
