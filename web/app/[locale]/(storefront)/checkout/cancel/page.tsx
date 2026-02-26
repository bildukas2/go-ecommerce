import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14 space-y-6 text-center">
      <h1 className="text-2xl font-semibold">Checkout canceled</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        No payment was completed. Your cart is still available.
      </p>
      <div>
        <Link href="/checkout" className="text-sm underline">
          Return to checkout
        </Link>
      </div>
    </div>
  );
}
