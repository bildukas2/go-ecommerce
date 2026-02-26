import Link from "next/link";

export default async function SuccessPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const orderId = params.order_id || params.order || "";
  const status = params.status || "paid";

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 space-y-6 text-center">
      <h1 className="text-2xl font-semibold">Thank you!</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">Your order has been created.</p>
      <div className="text-sm">
        {orderId ? <div>Order ID: <span className="font-mono">{orderId}</span></div> : null}
        <div>Status: <span className="font-semibold capitalize">{status.replace("_", " ")}</span></div>
      </div>
      <div>
        <Link href="/products" className="text-sm underline">Continue shopping</Link>
      </div>
    </div>
  );
}
