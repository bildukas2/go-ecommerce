"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-context";
import type { ProductVariant } from "@/lib/api";

type AddToCartButtonProps = {
  variants: ProductVariant[];
};

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
    }).format((cents || 0) / 100);
  } catch {
    return `${(cents || 0) / 100} ${currency || ""}`.trim();
  }
}

function variantLabel(variant: ProductVariant): string {
  const attrs = Object.entries(variant.attributes || {})
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
  const primary = attrs ? `${variant.sku} (${attrs})` : variant.sku;
  return `${primary} - ${formatMoney(variant.priceCents, variant.currency)}`;
}

export function AddToCartButton({ variants }: AddToCartButtonProps) {
  const [selectedVariantID, setSelectedVariantID] = React.useState<string>("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string>("");
  const { add } = useCart();

  React.useEffect(() => {
    if (variants.length === 0) {
      setSelectedVariantID("");
      return;
    }
    const firstAvailable = variants.find((variant) => variant.stock > 0) ?? variants[0];
    setSelectedVariantID(firstAvailable.id);
  }, [variants]);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantID) ?? null;
  const canAdd = !!selectedVariant && selectedVariant.stock > 0;

  async function onClick() {
    if (!selectedVariantID) return;
    setStatus("loading");
    setMessage("");
    try {
      await add(selectedVariantID, 1);
      setStatus("done");
      setMessage("Added to cart.");
    } catch {
      setStatus("error");
      setMessage("Failed to add item. Please try again.");
    }
  }

  if (variants.length === 0) {
    return (
      <div>
        <Button disabled>Unavailable</Button>
        <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          This product has no purchasable variants yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label htmlFor="variant" className="block text-sm font-medium">
        Variant
      </label>
      <select
        id="variant"
        value={selectedVariantID}
        onChange={(event) => setSelectedVariantID(event.target.value)}
        className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variantLabel(variant)}
            {variant.stock <= 0 ? " (Out of stock)" : ""}
          </option>
        ))}
      </select>
      <Button onClick={onClick} disabled={status === "loading" || !canAdd}>
        {status === "loading" ? "Adding..." : "Add to Cart"}
      </Button>
      {selectedVariant && (
        <p className="text-xs text-neutral-500">Stock: {Math.max(0, selectedVariant.stock)}</p>
      )}
      {message && <p className="text-sm text-neutral-600 dark:text-neutral-400">{message}</p>}
    </div>
  );
}
