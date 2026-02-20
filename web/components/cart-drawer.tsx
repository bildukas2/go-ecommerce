"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/cart-context";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { isBlockedIPError } from "@/lib/api";

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
    <Button variant="outline" onClick={openDrawer} className="glass relative">
      <ShoppingBag size={16} className="mr-2" />
      Cart
      {count > 0 ? <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-foreground">{count}</span> : null}
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

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeDrawer}
          />
          <motion.div
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-surface-border bg-background/95 shadow-2xl backdrop-blur-xl"
            initial={{ x: 420, opacity: 0.9 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-surface-border p-4">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-primary" />
                <h2 className="text-base font-semibold">Your Cart</h2>
              </div>
              <button
                onClick={closeDrawer}
                className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                aria-label="Close cart"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-auto p-4">
              {loading && <div className="text-sm text-neutral-600 dark:text-neutral-400">Loading...</div>}
              {error && <div className="text-sm text-red-600">{error}</div>}
              {checkoutError && <div className="text-sm text-red-600">{checkoutError}</div>}

              {!loading && cart && cart.Items.length === 0 ? (
                <GlassCard className="p-6 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                    <ShoppingBag size={18} className="text-primary" />
                  </div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">Your cart is empty.</div>
                </GlassCard>
              ) : null}

              {!loading && cart && cart.Items.length > 0 ? (
                <ul className="space-y-3">
                  {cart.Items.map((it) => {
                    const isMutating = mutatingItemIds.includes(it.ID);
                    const lineTotal = it.UnitPriceCents * it.Quantity;

                    return (
                      <li key={it.ID}>
                        <GlassCard className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-surface-border bg-black/5 dark:bg-white/5">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={it.ImageURL || "/images/noImage.png"}
                                alt={it.ProductTitle || "Product image"}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{it.ProductTitle || `Variant ${it.ProductVariantID.slice(0, 8)}`}</div>
                              <div className="text-xs text-neutral-600 dark:text-neutral-400">{formatCents(it.UnitPriceCents, it.Currency)} each</div>
                              <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                                {formatCents(lineTotal, it.Currency)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                className="rounded-full border border-surface-border bg-surface p-1.5 text-sm disabled:opacity-60"
                                onClick={() => update(it.ID, Math.max(1, it.Quantity - 1))}
                                disabled={isMutating || loading}
                                aria-label="Decrease quantity"
                              >
                                <Minus size={14} />
                              </button>
                              <motion.span
                                key={`${it.ID}-${it.Quantity}`}
                                className="w-6 text-center text-sm"
                                initial={{ scale: 0.92, opacity: 0.8 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.16 }}
                              >
                                {it.Quantity}
                              </motion.span>
                              <button
                                className="rounded-full border border-surface-border bg-surface p-1.5 text-sm disabled:opacity-60"
                                onClick={() => update(it.ID, it.Quantity + 1)}
                                disabled={isMutating || loading}
                                aria-label="Increase quantity"
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                className="ml-1 text-xs text-red-600 hover:underline disabled:opacity-60"
                                onClick={() => remove(it.ID)}
                                disabled={isMutating || loading}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </GlassCard>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <div className="space-y-3 border-t border-surface-border p-4">
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
                    if (isBlockedIPError(e)) {
                      window.location.href = e.redirectTo;
                      return;
                    }
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
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
