import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AccountShell } from "@/components/account/account-shell";
import { getAccountOrder, type AccountOrderDetail } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

function humanizeStatus(status: string, t: (key: string) => string): { label: string; color: string } {
  const colorMap: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    pending_payment: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    shipped: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  const statusKeyMap: Record<string, string> = {
    pending: "status_pending",
    pending_payment: "status_pending_payment",
    paid: "status_paid",
    completed: "status_completed",
    processing: "status_processing",
    shipped: "status_shipped",
    delivered: "status_delivered",
    cancelled: "status_cancelled",
  };
  const key = statusKeyMap[status];
  return {
    label: key ? t(key) : status,
    color: colorMap[status] ?? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  };
}

function humanizePaymentMethod(method: string, title: string, t: (key: string) => string): string {
  if (title) return title;
  const keyMap: Record<string, string> = {
    bank_transfer: "payment_bank_transfer",
    cash_on_delivery: "payment_cash_on_delivery",
    stripe: "payment_stripe",
  };
  const key = keyMap[method];
  if (key) return t(key);
  return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function OrderDetailContent({ order, t }: { order: AccountOrderDetail; t: (key: string, values?: Record<string, string>) => string }) {
  const statusInfo = humanizeStatus(order.status, t);
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
        { label: t("bank_account_holder"), value: bankConfig.account_name },
        { label: t("bank_name"), value: bankConfig.bank_name },
        { label: t("bank_account_number"), value: bankConfig.account_number },
        { label: t("bank_iban"), value: bankConfig.iban },
        { label: t("bank_bic"), value: bankConfig.bic_swift },
        { label: t("bank_sort_code"), value: bankConfig.sort_code },
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
            {t("back_to_orders")}
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
          <h2 className="mb-4 font-semibold">{t("items")}</h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 border-b border-surface-border pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{item.product_title}</p>
                  {item.variant_sku && (
                    <p className="text-xs text-neutral-500">{t("sku", { sku: item.variant_sku })}</p>
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
                  <p className="text-xs text-neutral-400">{t("each", { price: formatMoney(item.unit_price_cents, item.currency) })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl border border-surface-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">{t("summary")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">{t("subtotal")}</span>
              <span>{formatMoney(order.subtotal_cents, order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">{t("shipping")}</span>
              <span>{formatMoney(order.shipping_cents, order.currency)}</span>
            </div>
            {order.tax_cents > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-500">{t("tax")}</span>
                <span>{formatMoney(order.tax_cents, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-surface-border pt-2 font-semibold">
              <span>{t("total")}</span>
              <span>{formatMoney(order.total_cents, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Shipping Info */}
        <div className="rounded-2xl border border-surface-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">{t("shipping_info")}</h2>
          <div className="space-y-2 text-sm">
            {shipping.method_title && (
              <div>
                <p className="text-xs text-neutral-500">{t("method")}</p>
                <p>{shipping.method_title}</p>
              </div>
            )}
            {(shipping.full_name || shipping.phone) && (
              <div>
                <p className="text-xs text-neutral-500">{t("recipient")}</p>
                {shipping.full_name && <p>{shipping.full_name}</p>}
                {shipping.phone && <p className="text-neutral-500">{shipping.phone}</p>}
              </div>
            )}
            {addressLines.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500">{t("address")}</p>
                {addressLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}
            {shipping.terminal_name && (
              <div>
                <p className="text-xs text-neutral-500">{t("pickup_point")}</p>
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
          <h2 className="mb-4 font-semibold">{t("payment")}</h2>
          <div className="text-sm">
            <p className="text-xs text-neutral-500">{t("method")}</p>
            <p className="font-medium">{humanizePaymentMethod(payment.method, payment.title, t)}</p>
            {isBankTransfer && (
              <a
                href="#how-to-pay"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                {t("how_to_pay")}
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
              <h2 className="text-lg font-bold text-blue-900 dark:text-blue-200">{t("how_to_pay_title")}</h2>
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
                {t("bank_transfer_instructions", { number: order.number })}
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
                  {t("bank_unavailable")}
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
  const t = await getTranslations("account.order_detail");

  let order: AccountOrderDetail;
  try {
    order = await getAccountOrder(id, { cookieHeader });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") {
      redirect("/account/login?next=/account/orders");
    }
    return (
      <AccountShell title={t("not_found_title")} active="orders">
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface p-6 text-sm text-neutral-600 dark:text-neutral-400">
          <p>{t("not_found_text")}</p>
          <Link
            href="/account/orders"
            className="mt-3 inline-flex items-center gap-1 text-sm underline hover:no-underline"
          >
            {t("back_to_orders")}
          </Link>
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell title={`#${order.number}`} active="orders">
      <OrderDetailContent order={order} t={t} />
    </AccountShell>
  );
}
