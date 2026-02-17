import Link from "next/link";
import { DashboardRecentOrder } from "@/lib/api";
import { StatusBadge } from "./status-badge";

interface RecentOrdersTableProps {
  orders: DashboardRecentOrder[];
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  return (
    <div className="glass rounded-2xl border text-foreground shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
      <div className="flex items-center justify-between p-6">
        <h3 className="text-lg font-semibold leading-none tracking-tight">Recent Orders</h3>
        <span className="rounded-full bg-foreground/6 px-2 py-1 text-xs text-foreground/75">
          {orders.length} shown
        </span>
      </div>
      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b [&_tr]:border-surface-border">
            <tr className="border-b">
              <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Order Number</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Status</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Total</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Date</th>
              <th className="h-12 px-4 text-right align-middle font-medium text-foreground/70">Actions</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-foreground/65">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-surface-border transition-colors hover:bg-foreground/[0.04]">
                  <td className="p-4 align-middle font-mono text-xs font-semibold md:text-sm">{order.number}</td>
                  <td className="p-4 align-middle">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="p-4 align-middle">
                    {(order.total_cents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: order.currency.toUpperCase(),
                    })}
                  </td>
                  <td className="p-4 align-middle">
                    {new Date(order.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="p-4 align-middle text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-300"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
