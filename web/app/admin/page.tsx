import Link from "next/link";
import { getDashboard } from "@/lib/api";
import { DashboardMetrics } from "@/components/admin/dashboard-metrics";
import { RecentOrdersTable } from "@/components/admin/recent-orders-table";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage() {
  const dashboard = await getDashboard();

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
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

      <DashboardMetrics metrics={dashboard.metrics} />

      <RecentOrdersTable orders={dashboard.recent_orders} />
    </div>
  );
}
