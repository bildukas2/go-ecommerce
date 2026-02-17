"use client";

import * as React from "react";
import Link from "next/link";
import { Chip } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-context";
import type { ProductVariant } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type AddToCartButtonProps = {
  variants: ProductVariant[];
  selectedVariantID?: string;
  onSelectedVariantIDChange?: (variantID: string) => void;
  showSelectionMeta?: boolean;
};

function variantLabel(variant: ProductVariant): string {
  const attrs = Object.entries(variant.attributes || {})
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" / ");
  const primary = attrs ? `${variant.sku} (${attrs})` : variant.sku;
  return `${primary} - ${formatMoney(variant.priceCents, variant.currency)}`;
}

export function AddToCartButton({
  variants,
  selectedVariantID,
  onSelectedVariantIDChange,
  showSelectionMeta = true,
}: AddToCartButtonProps) {
  const [localSelectedVariantID, setLocalSelectedVariantID] = React.useState<string>("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string>("");
  const { add } = useCart();
  const currentSelectedVariantID = selectedVariantID ?? localSelectedVariantID;
  const setSelectedVariantID = (variantID: string) => {
    if (onSelectedVariantIDChange) {
      onSelectedVariantIDChange(variantID);
      return;
    }
    setLocalSelectedVariantID(variantID);
  };

  React.useEffect(() => {
    if (variants.length === 0) {
      if (onSelectedVariantIDChange) {
        onSelectedVariantIDChange("");
      } else {
        setLocalSelectedVariantID("");
      }
      return;
    }
    const firstAvailable = variants.find((variant) => variant.stock > 0) ?? variants[0];
    if (onSelectedVariantIDChange) {
      onSelectedVariantIDChange(firstAvailable.id);
    } else {
      setLocalSelectedVariantID(firstAvailable.id);
    }
  }, [onSelectedVariantIDChange, variants]);

  const selectedVariant = variants.find((variant) => variant.id === currentSelectedVariantID) ?? null;
  const hasPurchasableVariant = variants.some((variant) => variant.stock > 0);
  const disableControls = variants.length === 0 || !hasPurchasableVariant;
  const canAdd = !!selectedVariant && selectedVariant.stock > 0;

  async function onClick() {
    if (!currentSelectedVariantID) return;
    setStatus("loading");
    setMessage("");
    try {
      await add(currentSelectedVariantID, 1);
      setStatus("done");
      setMessage("Added to cart.");
    } catch {
      setStatus("error");
      setMessage("Failed to add item. Please try again.");
    }
  }

  if (variants.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-surface-border bg-surface/70 p-4">
          <label htmlFor="variant-unavailable" className="block text-sm font-medium">
            Variant
          </label>
          <select
            id="variant-unavailable"
            disabled
            className="mt-2 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm opacity-70"
          >
            <option>No purchasable variants</option>
          </select>
          <Button className="mt-3 w-full rounded-xl" disabled>
            Notify Me
          </Button>
        </div>

        <div className="glass rounded-2xl border border-white/10 bg-background/60 p-4">
          <Chip size="sm" color="warning" variant="flat">
            Unavailable
          </Chip>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            This product is not available for purchase yet. Check back soon.
          </p>
          <Button asChild variant="outline" className="mt-3 rounded-xl">
            <Link href="/products">Back to products</Link>
          </Button>
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
        value={currentSelectedVariantID}
        onChange={(event) => setSelectedVariantID(event.target.value)}
        disabled={disableControls}
        className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variantLabel(variant)}
            {variant.stock <= 0 ? " (Out of stock)" : ""}
          </option>
        ))}
      </select>

      <Button
        onClick={onClick}
        className="rounded-xl"
        disabled={status === "loading" || !canAdd || disableControls}
      >
        {status === "loading" ? "Adding..." : disableControls ? "Notify Me" : "Add to Cart"}
      </Button>

      {!hasPurchasableVariant && (
        <div className="glass rounded-2xl border border-white/10 bg-background/60 p-4">
          <Chip size="sm" color="warning" variant="flat">
            Out of stock
          </Chip>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            All variants are currently out of stock.
          </p>
          <Button asChild variant="outline" className="mt-3 rounded-xl">
            <Link href="/products">Back to products</Link>
          </Button>
        </div>
      )}

      {showSelectionMeta && selectedVariant && (
        <div className="space-y-1 text-xs text-neutral-500">
          <p>SKU: {selectedVariant.sku || "N/A"}</p>
          <p>Price: {formatMoney(selectedVariant.priceCents, selectedVariant.currency)}</p>
          <p>Stock: {Math.max(0, selectedVariant.stock)}</p>
          <p>
            Attributes:{" "}
            {Object.entries(selectedVariant.attributes || {}).length > 0
              ? Object.entries(selectedVariant.attributes || {})
                  .map(([key, value]) => `${key}: ${String(value)}`)
                  .join(" / ")
              : "N/A"}
          </p>
        </div>
      )}
      {message && <p className="text-sm text-neutral-600 dark:text-neutral-400">{message}</p>}
    </div>
  );
}
