"use client";

import * as React from "react";
import { checkout } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await checkout();
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      setError("No checkout URL returned");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Checkout failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 space-y-4">
      <h1 className="text-2xl font-semibold">Checkout</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">Proceed to payment using the provider in test mode.</p>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <Button onClick={onCheckout} disabled={loading}>{loading ? "Redirecting…" : "Proceed to Payment"}</Button>
    </div>
  );
}
