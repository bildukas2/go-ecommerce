"use client";

import * as React from "react";
import { AddToCartButton } from "@/components/add-to-cart";
import type { ProductVariant } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type ProductPurchasePanelProps = {
  title: string;
  description: string;
  variants: ProductVariant[];
};

export function ProductPurchasePanel({ title, description, variants }: ProductPurchasePanelProps) {
  const defaultVariant = variants.find((variant) => variant.stock > 0) ?? variants[0] ?? null;
  const [selectedVariantID, setSelectedVariantID] = React.useState<string>(defaultVariant?.id ?? "");
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantID) ?? defaultVariant;
  const inStockCount = variants.filter((variant) => variant.stock > 0).length;
  const variantPrices = variants.map((variant) => variant.priceCents);
  const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : null;
  const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : null;
  const selectedAttributes = selectedVariant ? Object.entries(selectedVariant.attributes) : [];

  React.useEffect(() => {
    const fallback = variants.find((variant) => variant.stock > 0) ?? variants[0];
    if (!fallback) {
      setSelectedVariantID("");
      return;
    }
    const exists = variants.some((variant) => variant.id === selectedVariantID);
    if (!exists) {
      setSelectedVariantID(fallback.id);
    }
  }, [variants, selectedVariantID]);

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="glass rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            {inStockCount > 0 ? `${inStockCount} in stock` : "Currently unavailable"}
          </span>
          <span className="rounded-full border border-surface-border bg-surface/70 px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            {variants.length} variants
          </span>
        </div>
        <h1 className="mb-1 text-3xl font-semibold leading-tight">{title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-background/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Price</h2>
        {selectedVariant ? (
          <>
            <p className="mt-1 text-3xl font-semibold">
              {formatMoney(selectedVariant.priceCents, selectedVariant.currency)}
            </p>
            {minPrice !== null && maxPrice !== null && (
              <p className="mt-1 text-xs text-neutral-500">
                Range: {formatMoney(minPrice, selectedVariant.currency)}
                {" - "}
                {formatMoney(maxPrice, selectedVariant.currency)}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">No active price</p>
        )}
      </div>

      <div className="rounded-2xl border border-surface-border bg-background/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Variant details</h2>
        {selectedVariant ? (
          <div className="mt-2 space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">SKU:</span> {selectedVariant.sku || "N/A"}
            </p>
            <p>
              <span className="text-neutral-500">Stock:</span> {Math.max(0, selectedVariant.stock)}
            </p>
            <p>
              <span className="text-neutral-500">Attributes:</span>{" "}
              {selectedAttributes.length > 0
                ? selectedAttributes.map(([key, value]) => `${key}: ${String(value)}`).join(" / ")
                : "N/A"}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">No variant metadata</p>
        )}
      </div>

      <div className="pt-2">
        <AddToCartButton
          variants={variants}
          selectedVariantID={selectedVariantID}
          onSelectedVariantIDChange={setSelectedVariantID}
          showSelectionMeta={false}
        />
      </div>
    </>
  );
}
