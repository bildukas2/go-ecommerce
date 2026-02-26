import Link from "next/link";
import { firstSearchParam } from "@/lib/checkout-state";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const orderId = firstSearchParam(params.order_id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 space-y-6 text-center">
      <h1 className="text-2xl font-semibold">Order created</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Your order is pending payment confirmation.
      </p>
      {orderId ? (
        <p className="text-sm">
          Order ID: <span className="font-mono">{orderId}</span>
        </p>
      ) : null}
      <div>
        <Link href="/products" className="text-sm underline">
          Back to products
        </Link>
      </div>
    </div>
  );
}
