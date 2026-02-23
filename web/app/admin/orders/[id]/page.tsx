import Link from "next/link";
import { getAdminOrder } from "@/lib/api";
import { isNotFoundAdminError, isUnauthorizedAdminError } from "@/lib/admin-orders-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Package,
  Truck,
  UserRound,
} from "lucide-react";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function asMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: currency || "USD",
  });
}

function asDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function maybeValue(value: string): string {
  return value.trim() || "-";
}

function addressLines(address: {
  full_name?: string;
  phone?: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}): string[] {
  const locality = [address.city, address.state, address.postcode]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(", ");
  return [
    address.full_name?.trim() ?? "",
    address.phone?.trim() ?? "",
    address.address1.trim(),
    address.address2.trim(),
    locality,
    address.country.trim(),
  ].filter((line) => line.length > 0);
}

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
        <p className="text-foreground/70">Set ADMIN_USER and ADMIN_PASS on the server, then reload this page.</p>
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

  const moneyCurrency = order.order.currency || "USD";
  const shippingAddress = addressLines({
    full_name: order.shipping.full_name,
    phone: order.shipping.phone,
    address1: order.shipping.address1,
    address2: order.shipping.address2,
    city: order.shipping.city,
    state: order.shipping.state,
    postcode: order.shipping.postcode,
    country: order.shipping.country,
  });
  const billingAddress = addressLines({
    full_name: order.billing.full_name,
    address1: order.billing.address1,
    address2: order.billing.address2,
    city: order.billing.city,
    state: order.billing.state,
    postcode: order.billing.postcode,
    country: order.billing.country,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-xl border-surface-border bg-foreground/[0.03]">
            <Link href="/admin/orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Order {order.order.number || order.order.id}</h1>
              <StatusBadge status={order.order.status} />
            </div>
            <p className="mt-1 text-foreground/60">Placed on {asDateTime(order.order.created_at)}</p>
          </div>
        </div>
        <OrderStatusSelect orderId={order.order.id} currentStatus={order.order.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="glass flex flex-col gap-4 rounded-2xl border p-6 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
          <div className="flex items-center gap-2 text-foreground/70">
            <DollarSign className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Financial Summary</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">Subtotal</span>
              <span className="font-medium">{asMoney(order.order.subtotal_cents, moneyCurrency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">Shipping</span>
              <span className="font-medium">{asMoney(order.order.shipping_cents, moneyCurrency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">Tax</span>
              <span className="font-medium">{asMoney(order.order.tax_cents, moneyCurrency)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-surface-border pt-2">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">{asMoney(order.order.total_cents, moneyCurrency)}</span>
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
              <p className="mb-1 text-xs font-bold uppercase tracking-tight text-foreground/50">Order ID</p>
              <p className="break-all font-mono text-xs font-medium">{order.order.id}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-tight text-foreground/50">Currency</p>
              <p className="font-medium">{moneyCurrency}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-tight text-foreground/50">Items Count</p>
              <p className="font-medium">{order.items.length}</p>
            </div>
          </div>
        </div>

        <div className="glass flex flex-col gap-4 rounded-2xl border p-6 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
          <div className="flex items-center gap-2 text-foreground/70">
            <Clock className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Timeline</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <div>
                <p className="text-sm font-medium text-foreground">Created</p>
                <p className="text-xs text-foreground/60">{asDateTime(order.order.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-foreground/20" />
              <div>
                <p className="text-sm font-medium text-foreground">Last Updated</p>
                <p className="text-xs text-foreground/60">{asDateTime(order.order.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl border p-6 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
          <div className="mb-4 flex items-center gap-2 text-foreground/70">
            <UserRound className="h-4 w-4" />
            <h3 className="text-lg font-semibold tracking-tight">Customer</h3>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Name</dt>
              <dd className="font-medium">{maybeValue(`${order.customer.first_name} ${order.customer.last_name}`.trim())}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Customer ID</dt>
              <dd className="break-all font-mono text-xs">{maybeValue(order.customer.id)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Email</dt>
              <dd>{maybeValue(order.customer.email)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Phone</dt>
              <dd>{maybeValue(order.customer.phone)}</dd>
            </div>
          </dl>
        </section>

        <section className="glass rounded-2xl border p-6 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
          <div className="mb-4 flex items-center gap-2 text-foreground/70">
            <CreditCard className="h-4 w-4" />
            <h3 className="text-lg font-semibold tracking-tight">Payment</h3>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Method</dt>
              <dd className="font-medium">{maybeValue(order.payment.method)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Provider</dt>
              <dd>{maybeValue(order.payment.provider)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Shipping Charge</dt>
              <dd>{asMoney(order.shipping.price_cents, moneyCurrency)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Grand Total</dt>
              <dd className="font-semibold">{asMoney(order.order.total_cents, moneyCurrency)}</dd>
            </div>
          </dl>
        </section>

        <section className="glass rounded-2xl border p-6 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
          <div className="mb-4 flex items-center gap-2 text-foreground/70">
            <Truck className="h-4 w-4" />
            <h3 className="text-lg font-semibold tracking-tight">Shipping Method & Destination</h3>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Method</dt>
              <dd className="font-medium">{maybeValue(order.shipping.method_title)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Method ID</dt>
              <dd className="break-all font-mono text-xs">{maybeValue(order.shipping.method_id)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Provider</dt>
              <dd>{maybeValue(order.shipping.provider_key)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Service Code</dt>
              <dd>{maybeValue(order.shipping.service_code)}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Terminal / Pickup Point</dt>
              <dd>{maybeValue(order.shipping.terminal_id)}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Ship To</dt>
              <dd className="space-y-0.5">
                {shippingAddress.length === 0 ? (
                  <p>-</p>
                ) : (
                  shippingAddress.map((line) => (
                    <p key={line}>{line}</p>
                  ))
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="glass rounded-2xl border p-6 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
          <div className="mb-4 flex items-center gap-2 text-foreground/70">
            <FileText className="h-4 w-4" />
            <h3 className="text-lg font-semibold tracking-tight">Billing & Invoice</h3>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Billing Address</dt>
              <dd className="space-y-0.5">
                {billingAddress.length === 0 ? (
                  <p>-</p>
                ) : (
                  billingAddress.map((line) => (
                    <p key={line}>{line}</p>
                  ))
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Company</dt>
              <dd>{maybeValue(order.billing.company_name)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/60">VAT / Tax ID</dt>
              <dd>{maybeValue(order.billing.company_vat)}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-foreground/60">Invoice Email</dt>
              <dd>{maybeValue(order.billing.invoice_email)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="glass rounded-2xl border p-6 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold leading-none tracking-tight">Order Items</h3>
          <span className="rounded-full bg-foreground/6 px-2 py-1 text-xs text-foreground/75">
            {order.items.length} items
          </span>
        </div>
        <div className="space-y-4">
          {order.items.length === 0 && (
            <div className="rounded-xl border border-surface-border bg-foreground/[0.02] p-6 text-center text-sm text-foreground/60">
              No items found in this order.
            </div>
          )}

          {order.items.map((item) => (
            <article key={item.id} className="rounded-xl border border-surface-border bg-foreground/[0.02] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h4 className="font-semibold">{maybeValue(item.product_title)}</h4>
                  <p className="mt-1 text-xs text-foreground/60">
                    SKU: <span className="font-mono">{maybeValue(item.variant_sku)}</span>
                  </p>
                  <p className="mt-1 text-xs text-foreground/60">
                    Variant ID: <span className="font-mono">{maybeValue(item.product_variant_id)}</span>
                  </p>
                  <p className="mt-1 text-xs text-foreground/60">
                    Item ID: <span className="font-mono">{item.id}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-surface-border bg-background/70 px-3 py-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-foreground/60">Qty</span>
                    <span className="font-medium">{item.quantity}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-4">
                    <span className="text-foreground/60">Unit</span>
                    <span className="font-medium">{asMoney(item.unit_price_cents, item.currency || moneyCurrency)}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-4 border-t border-surface-border pt-1">
                    <span className="text-foreground/60">Line Total</span>
                    <span className="font-semibold">
                      {asMoney(item.unit_price_cents * item.quantity, item.currency || moneyCurrency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Variant Attributes</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {Object.keys(item.variant_attributes_json).length === 0 ? (
                      <p className="text-foreground/60">-</p>
                    ) : (
                      Object.entries(item.variant_attributes_json).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="font-medium">{key}:</span>
                          <span>{String(value)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Selected Custom Options</p>
                  <div className="mt-2 space-y-2 text-sm">
                    {item.custom_options_json.length === 0 ? (
                      <p className="text-foreground/60">-</p>
                    ) : (
                      item.custom_options_json.map((option, index) => {
                        const values = [
                          option.value_title,
                          option.value_titles.join(", "),
                          option.value_text,
                          option.value_id,
                          option.value_ids.join(", "),
                        ]
                          .map((value) => value.trim())
                          .filter((value) => value.length > 0);
                        return (
                          <div key={`${option.option_id}:${index}`} className="rounded-md border border-surface-border bg-background/70 px-3 py-2">
                            <p className="font-medium">
                              {maybeValue(option.title)} <span className="text-foreground/60">({maybeValue(option.type)})</span>
                            </p>
                            <p className="text-foreground/70">{values[0] || "-"}</p>
                            {option.price_delta_cents !== 0 && (
                              <p className="text-xs text-foreground/60">Price delta: {asMoney(option.price_delta_cents, item.currency || moneyCurrency)}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
