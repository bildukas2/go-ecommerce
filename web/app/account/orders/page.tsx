import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AccountShell } from "@/components/account/account-shell";
import { getAccountOrders } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountOrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsed = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const limit = 10;

  const cookieHeader = (await cookies()).toString();
  let response: Awaited<ReturnType<typeof getAccountOrders>>;
  try {
    response = await getAccountOrders({ page, limit }, { cookieHeader });
  } catch {
    redirect("/account/login?next=/account/orders");
  }

  const hasPrev = response.page > 1;
  const hasNext = response.page * response.limit < response.total;

  return (
    <AccountShell title="Purchase history" subtitle="Your previous orders and line items." active="orders">
      <div className="space-y-3">
        {response.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface p-6 text-sm text-neutral-600 dark:text-neutral-400">
            You have no orders yet.
          </div>
        ) : (
          response.items.map((order) => (
            <article key={order.id} className="rounded-2xl border border-surface-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">{order.number}</p>
                  <h2 className="mt-1 font-semibold">{order.status}</h2>
                  <p className="text-xs text-neutral-500">{new Date(order.created_at).toLocaleString()}</p>
                </div>
                <p className="text-lg font-semibold">{formatMoney(order.total_cents, order.currency)}</p>
              </div>
              <ul className="mt-4 space-y-2 border-t border-surface-border pt-3 text-sm">
                {order.items.map((item) => (
                  <li key={`${order.id}-${item.product_id}`} className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      {item.title} <span className="text-neutral-500">x{item.quantity}</span>
                    </span>
                    <span className="text-neutral-600 dark:text-neutral-300">
                      {formatMoney(item.unit_price_cents, item.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface p-4 text-sm">
        <Link href={hasPrev ? `/account/orders?page=${response.page - 1}` : "#"} className={hasPrev ? "underline" : "pointer-events-none text-neutral-400"}>
          Previous
        </Link>
        <span>
          Page {response.page}
        </span>
        <Link href={hasNext ? `/account/orders?page=${response.page + 1}` : "#"} className={hasNext ? "underline" : "pointer-events-none text-neutral-400"}>
          Next
        </Link>
      </div>
    </AccountShell>
  );
}
