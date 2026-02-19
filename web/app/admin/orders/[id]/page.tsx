import Link from "next/link";
import { getAdminOrder } from "@/lib/api";
import { isNotFoundAdminError, isUnauthorizedAdminError } from "@/lib/admin-orders-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, DollarSign, Clock } from "lucide-react";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: Params) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  if (!user || !pass) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href="/admin/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Admin Not Configured</h1>
        </div>
        <p className="text-foreground/70">
          Set ADMIN_USER and ADMIN_PASS on the server, then reload this page.
        </p>
      </div>
    );
  }

  const { id } = await params;

  let order: Awaited<ReturnType<typeof getAdminOrder>> | null = null;
  let fetchError: string | null = null;

  try {
    order = await getAdminOrder(id);
  } catch (error) {
    if (isUnauthorizedAdminError(error)) {
      fetchError = "Unauthorized. Check ADMIN_USER and ADMIN_PASS server credentials.";
    } else if (isNotFoundAdminError(error)) {
      fetchError = "Order not found.";
    } else {
      fetchError = "Failed to fetch order. Please retry.";
    }
  }

  if (fetchError) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href="/admin/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Order Detail</h1>
        </div>
        <div className="rounded-2xl border border-red-200/50 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {fetchError}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href="/admin/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Order Detail</h1>
        </div>
        <div className="rounded-2xl border border-surface-border bg-foreground/[0.03] p-8 text-center text-foreground/60">
          Order data is unavailable.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-xl border-surface-border bg-foreground/[0.03]">
            <Link href="/admin/orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Order {order.Number}</h1>
              <StatusBadge status={order.Status} />
            </div>
            <p className="mt-1 text-foreground/60">
              Placed on {order.CreatedAt ? new Date(order.CreatedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short"
              }) : "-"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <OrderStatusSelect orderId={order.ID} currentStatus={order.Status} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="glass flex flex-col gap-4 rounded-2xl border p-6 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
          <div className="flex items-center gap-2 text-foreground/70">
            <DollarSign className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Financial Summary</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">Subtotal</span>
              <span className="font-medium">
                {(order.SubtotalCents / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: order.Currency || "USD",
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">Shipping</span>
              <span className="font-medium">
                {(order.ShippingCents / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: order.Currency || "USD",
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">Tax</span>
              <span className="font-medium">
                {(order.TaxCents / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: order.Currency || "USD",
                })}
              </span>
            </div>
            <div className="mt-2 border-t border-surface-border pt-2 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">
                {(order.TotalCents / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: order.Currency || "USD",
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="glass flex flex-col gap-4 rounded-2xl border p-6 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
          <div className="flex items-center gap-2 text-foreground/70">
            <Package className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Order Metadata</h2>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-foreground/50 uppercase font-bold tracking-tight mb-1">Order ID</p>
              <p className="font-mono text-xs font-medium break-all">{order.ID}</p>
            </div>
            <div>
              <p className="text-xs text-foreground/50 uppercase font-bold tracking-tight mb-1">Currency</p>
              <p className="font-medium">{order.Currency || "USD"}</p>
            </div>
          </div>
        </div>

        <div className="glass flex flex-col gap-4 rounded-2xl border p-6 shadow-[0_14px_30_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
          <div className="flex items-center gap-2 text-foreground/70">
            <Clock className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Timeline</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <div>
                <p className="text-sm font-medium text-foreground">Created</p>
                <p className="text-xs text-foreground/60">
                  {order.CreatedAt ? new Date(order.CreatedAt).toLocaleString() : "-"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-foreground/20" />
              <div>
                <p className="text-sm font-medium text-foreground">Last Updated</p>
                <p className="text-xs text-foreground/60">
                  {order.UpdatedAt ? new Date(order.UpdatedAt).toLocaleString() : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="glass overflow-hidden rounded-2xl border text-foreground shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
        <div className="flex items-center justify-between p-6">
          <h3 className="text-lg font-semibold leading-none tracking-tight">Order Items</h3>
          <span className="rounded-full bg-foreground/6 px-2 py-1 text-xs text-foreground/75">
            {order.Items.length} items
          </span>
        </div>
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead>
              <tr className="border-b border-surface-border transition-colors">
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Variant</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Qty</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Unit Price</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-foreground/70">Line Total</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {order.Items.map((it) => (
                <tr key={it.ID} className="border-b border-surface-border transition-colors hover:bg-foreground/[0.04]">
                  <td className="p-4 align-middle font-mono text-xs font-semibold md:text-sm">
                    {it.ProductVariantID}
                  </td>
                  <td className="p-4 align-middle">
                    <span className="rounded-md bg-foreground/5 px-2 py-0.5 font-medium">
                      {it.Quantity}
                    </span>
                  </td>
                  <td className="p-4 align-middle text-foreground/80">
                    {(it.UnitPriceCents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: it.Currency || order?.Currency || "USD",
                    })}
                  </td>
                  <td className="p-4 align-middle text-right font-bold">
                    {((it.UnitPriceCents * it.Quantity) / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: it.Currency || order?.Currency || "USD",
                    })}
                  </td>
                </tr>
              ))}
              {order.Items.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-foreground/60">
                    No items found in this order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
