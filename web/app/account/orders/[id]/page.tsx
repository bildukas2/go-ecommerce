import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AccountShell } from "@/components/account/account-shell";
import { getAccountOrder, type AccountOrderDetail } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

function humanizeStatus(status: string): { label: string; color: string } {
  switch (status) {
    case "pending":
      return { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" };
    case "processing":
      return { label: "Processing", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" };
    case "shipped":
      return { label: "Shipped", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" };
    case "delivered":
      return { label: "Delivered", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" };
    case "cancelled":
      return { label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" };
    default:
      return { label: status, color: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" };
  }
}

function humanizePaymentMethod(method: string, title: string): string {
  if (title) return title;
  switch (method) {
    case "bank_transfer":
      return "Bank Transfer";
    case "cash_on_delivery":
      return "Cash on Delivery";
    case "stripe":
      return "Credit / Debit Card";
    default:
      return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function OrderDetailContent({ order }: { order: AccountOrderDetail }) {
  const statusInfo = humanizeStatus(order.status);
  const isBankTransfer = order.payment.method === "bank_transfer";
  const { shipping, payment } = order;

  const addressLines = [
    shipping.address1,
    shipping.address2,
    [shipping.city, shipping.state].filter(Boolean).join(", "),
    [shipping.postcode, shipping.country].filter(Boolean).join(" "),
  ].filter(Boolean);

  const bankConfig = payment.bank_config;
  const bankFields: Array<{ label: string; value: string }> = bankConfig
    ? [
        { label: "Account Holder", value: bankConfig.account_name },
        { label: "Bank", value: bankConfig.bank_name },
        { label: "Account Number", value: bankConfig.account_number },
        { label: "IBAN", value: bankConfig.iban },
        { label: "BIC / SWIFT", value: bankConfig.bic_swift },
        { label: "Sort Code", value: bankConfig.sort_code },
      ].filter((f) => f.value)
    : [];

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="rounded-2xl border border-surface-border bg-surface p-5">
        <div className="mb-4">
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Orders
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">{order.number}</p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}
              >
                {statusInfo.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <p className="text-2xl font-bold">{formatMoney(order.total_cents, order.currency)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Order Items */}
        <div className="rounded-2xl border border-surface-border bg-surface p-5 md:col-span-2">
          <h2 className="mb-4 font-semibold">Items</h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 border-b border-surface-border pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{item.product_title}</p>
                  {item.variant_sku && (
                    <p className="text-xs text-neutral-500">SKU: {item.variant_sku}</p>
                  )}
                  {Array.isArray(item.custom_options) && item.custom_options.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.custom_options.map((opt, i) => (
                        <span
                          key={i}
                          className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                        >
                          {String(opt)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p className="text-neutral-500">x{item.quantity}</p>
                  <p className="font-medium">{formatMoney(item.unit_price_cents * item.quantity, item.currency)}</p>
                  <p className="text-xs text-neutral-400">{formatMoney(item.unit_price_cents, item.currency)} each</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl border border-surface-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Subtotal</span>
              <span>{formatMoney(order.subtotal_cents, order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Shipping</span>
              <span>{formatMoney(order.shipping_cents, order.currency)}</span>
            </div>
            {order.tax_cents > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-500">Tax</span>
                <span>{formatMoney(order.tax_cents, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-surface-border pt-2 font-semibold">
              <span>Total</span>
              <span>{formatMoney(order.total_cents, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Shipping Info */}
        <div className="rounded-2xl border border-surface-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">Shipping</h2>
          <div className="space-y-2 text-sm">
            {shipping.method_title && (
              <div>
                <p className="text-xs text-neutral-500">Method</p>
                <p>{shipping.method_title}</p>
              </div>
            )}
            {(shipping.full_name || shipping.phone) && (
              <div>
                <p className="text-xs text-neutral-500">Recipient</p>
                {shipping.full_name && <p>{shipping.full_name}</p>}
                {shipping.phone && <p className="text-neutral-500">{shipping.phone}</p>}
              </div>
            )}
            {addressLines.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500">Address</p>
                {addressLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}
            {shipping.terminal_name && (
              <div>
                <p className="text-xs text-neutral-500">Pickup point</p>
                <p>
                  {shipping.terminal_name}
                  {shipping.terminal_address ? `, ${shipping.terminal_address}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Info */}
        <div className="rounded-2xl border border-surface-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">Payment</h2>
          <div className="text-sm">
            <p className="text-xs text-neutral-500">Method</p>
            <p className="font-medium">{humanizePaymentMethod(payment.method, payment.title)}</p>
            {isBankTransfer && (
              <a
                href="#how-to-pay"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                How to Pay?
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Bank Transfer Instructions */}
        {isBankTransfer && (
          <div
            id="how-to-pay"
            className="rounded-2xl border border-blue-300 bg-blue-50 p-6 dark:border-blue-700 dark:bg-blue-950/30 md:col-span-2 scroll-mt-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                <svg
                  className="h-5 w-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-blue-900 dark:text-blue-200">How to Pay</h2>
            </div>
            {payment.description && (
              <p className="mb-4 text-sm font-medium text-blue-900 dark:text-blue-200">
                {payment.description}
              </p>
            )}
            {payment.instructions ? (
              <p className="mb-6 text-sm leading-relaxed text-blue-800 dark:text-blue-300">
                {payment.instructions}
              </p>
            ) : (
              <p className="mb-6 text-sm leading-relaxed text-blue-800 dark:text-blue-300">
                Please make a bank transfer using the details below. Include your order number{" "}
                <span className="font-bold text-blue-900 dark:text-blue-100">{order.number}</span> as the
                payment reference.
              </p>
            )}
            {bankFields.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bankFields.map((field) => (
                  <div
                    key={field.label}
                    className="group relative rounded-xl border border-blue-100 bg-white/80 p-4 transition-all hover:border-blue-200 hover:shadow-sm dark:border-blue-800/50 dark:bg-blue-900/20"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">
                      {field.label}
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-blue-900 dark:text-blue-50">
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-blue-200 bg-blue-100/50 p-4 text-center dark:border-blue-800 dark:bg-blue-900/30">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Bank details are currently unavailable. Please contact support for assistance.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function AccountOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();

  let order: AccountOrderDetail;
  try {
    order = await getAccountOrder(id, { cookieHeader });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") {
      redirect("/account/login?next=/account/orders");
    }
    // NOT_FOUND or any other error
    return (
      <AccountShell title="Order not found" active="orders">
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface p-6 text-sm text-neutral-600 dark:text-neutral-400">
          <p>This order could not be found or does not belong to your account.</p>
          <Link
            href="/account/orders"
            className="mt-3 inline-flex items-center gap-1 text-sm underline hover:no-underline"
          >
            Back to Orders
          </Link>
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell title={`Order ${order.number}`} active="orders">
      <OrderDetailContent order={order} />
    </AccountShell>
  );
}
