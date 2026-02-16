"use client";

import * as React from "react";
import { useCart } from "@/components/cart-context";
import { Button } from "@/components/ui/button";

function formatCents(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "EUR" }).format((cents || 0) / 100);
  } catch {
    return `${(cents || 0) / 100} ${currency || ""}`.trim();
  }
}

export function CartButton() {
  const { cart, openDrawer } = useCart();
  const count = cart?.Totals?.ItemCount || 0;

  return (
    <Button variant="outline" onClick={openDrawer}>
      Cart{count > 0 ? ` (${count})` : ""}
    </Button>
  );
}

export function CartDrawer() {
  const { open, closeDrawer, cart, loading, error, mutatingItemIds, update, remove, checkout } = useCart();
  const [checkoutBusy, setCheckoutBusy] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);

  React.useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }

    if (open) {
      document.addEventListener("keydown", onEsc);
    }
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, closeDrawer]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-base font-semibold">Your Cart</h2>
          <button onClick={closeDrawer} className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          {loading && <div className="text-sm text-neutral-600 dark:text-neutral-400">Loading...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {checkoutError && <div className="text-sm text-red-600">{checkoutError}</div>}

          {!loading && cart && cart.Items.length === 0 && (
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Your cart is empty.</div>
          )}

          {!loading && cart && cart.Items.length > 0 && (
            <ul className="space-y-3">
              {cart.Items.map((it) => {
                const isMutating = mutatingItemIds.includes(it.ID);
                const lineTotal = it.UnitPriceCents * it.Quantity;

                return (
                  <li key={it.ID} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">Variant {it.ProductVariantID.slice(0, 8)}</div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">{formatCents(it.UnitPriceCents, it.Currency)} each</div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">Line total: {formatCents(lineTotal, it.Currency)}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-md border border-neutral-200 px-2 py-1 text-sm disabled:opacity-60 dark:border-neutral-800"
                        onClick={() => update(it.ID, Math.max(1, it.Quantity - 1))}
                        disabled={isMutating || loading}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm">{it.Quantity}</span>
                      <button
                        className="rounded-md border border-neutral-200 px-2 py-1 text-sm disabled:opacity-60 dark:border-neutral-800"
                        onClick={() => update(it.ID, it.Quantity + 1)}
                        disabled={isMutating || loading}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                      <button
                        className="ml-2 text-xs text-red-600 hover:underline disabled:opacity-60"
                        onClick={() => remove(it.ID)}
                        disabled={isMutating || loading}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-3 border-t border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">Subtotal</span>
            <span className="font-medium">{formatCents(cart?.Totals?.SubtotalCents || 0, cart?.Totals?.Currency || "EUR")}</span>
          </div>

          <Button
            className="w-full"
            disabled={!cart || cart.Items.length === 0 || loading || checkoutBusy}
            onClick={async () => {
              setCheckoutBusy(true);
              setCheckoutError(null);
              try {
                const res = await checkout();
                if (!res.checkout_url) {
                  setCheckoutError("No checkout URL returned.");
                  return;
                }
                window.location.href = res.checkout_url;
              } catch (e: unknown) {
                const message = e instanceof Error ? e.message : "Checkout failed";
                setCheckoutError(message);
              } finally {
                setCheckoutBusy(false);
              }
            }}
          >
            {checkoutBusy ? "Redirecting..." : "Checkout"}
          </Button>
        </div>
      </div>
    </div>
  );
}
