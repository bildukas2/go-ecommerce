import Link from "next/link";
import { getAdminOrders } from "@/lib/api";
import { isUnauthorizedAdminError, parsePositiveIntParam } from "@/lib/admin-orders-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  if (!user || !pass) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-2 text-2xl font-semibold">Admin Not Configured</h1>
        <p className="text-sm text-foreground/70 text-gray-600">
          Set ADMIN_USER and ADMIN_PASS on the server, then reload this page.
        </p>
      </div>
    );
  }

  const page = parsePositiveIntParam(params.page, 1);
  const limit = parsePositiveIntParam(params.limit, 20);

  let items: Awaited<ReturnType<typeof getAdminOrders>>["items"] = [];
  let fetchError: string | null = null;

  try {
    const response = await getAdminOrders({ page, limit });
    items = response.items;
  } catch (error) {
    if (isUnauthorizedAdminError(error)) {
      fetchError = "Unauthorized. Check ADMIN_USER and ADMIN_PASS server credentials.";
    } else {
      fetchError = "Failed to load orders. Please retry.";
    }
  }

  const hasPrev = page > 1;
  const hasNext = items.length === limit;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-foreground/70">Manage and track your store&apos;s orders</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-surface-border bg-foreground/[0.03] px-3 py-1 text-sm font-medium">
            <span className="text-foreground/50">Page</span>
            <span>{page}</span>
          </div>
          <div className="flex gap-2">
            <Button
              asChild
              variant="secondary"
              size="icon"
              disabled={!hasPrev}
              className="rounded-xl border border-surface-border bg-foreground/[0.03]"
            >
              {hasPrev ? (
                <Link href={`/admin/orders?page=${page - 1}&limit=${limit}`} aria-label="Previous page">
                  <ChevronLeft size={18} />
                </Link>
              ) : (
                <ChevronLeft size={18} className="opacity-50" />
              )}
            </Button>
            <Button
              asChild
              variant="secondary"
              size="icon"
              disabled={!hasNext}
              className="rounded-xl border border-surface-border bg-foreground/[0.03]"
            >
              {hasNext ? (
                <Link href={`/admin/orders?page=${page + 1}&limit=${limit}`} aria-label="Next page">
                  <ChevronRight size={18} />
                </Link>
              ) : (
                <ChevronRight size={18} className="opacity-50" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-2xl border border-red-200/50 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {fetchError}
        </div>
      )}

      <div className="glass overflow-hidden rounded-2xl border text-foreground shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead>
              <tr className="border-b border-surface-border transition-colors">
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Order Number</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Status</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Total</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Date</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-foreground/70">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-foreground/60">
                    {fetchError ? "Failed to load orders" : "No orders found"}
                  </td>
                </tr>
              ) : (
                items.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-surface-border transition-colors hover:bg-foreground/[0.04]"
                  >
                    <td className="p-4 align-middle font-mono text-xs font-semibold md:text-sm">
                      {order.number}
                    </td>
                    <td className="p-4 align-middle">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="p-4 align-middle font-medium">
                      {(order.total_cents / 100).toLocaleString(undefined, {
                        style: "currency",
                        currency: order.currency || "USD",
                      })}
                    </td>
                    <td className="p-4 align-middle text-foreground/70">
                      {new Date(order.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="font-medium text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                      >
                        <Link href={`/admin/orders/${encodeURIComponent(order.id)}`}>
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
