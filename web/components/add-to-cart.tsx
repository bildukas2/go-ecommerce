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
};

export function AddToCartButton({ variants }: AddToCartButtonProps) {
  const [selectedAttributes, setSelectedAttributes] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string>("");
  const { add } = useCart();

  // Extract all unique attribute keys and their possible values
  const allAttributes = React.useMemo(() => {
    const keys = Array.from(new Set(variants.flatMap((v) => Object.keys(v.attributes || {}))));
    const values: Record<string, string[]> = {};
    keys.forEach((key) => {
      values[key] = Array.from(
        new Set(
          variants
            .map((v) => v.attributes?.[key])
            .filter((v) => v !== undefined && v !== null)
            .map(String)
        )
      );
    });
    return { keys, values };
  }, [variants]);

  // Initial selection
  React.useEffect(() => {
    if (variants.length > 0 && Object.keys(selectedAttributes).length === 0) {
      const firstAvailable = variants.find((variant) => variant.stock > 0) ?? variants[0];
      const initialAttrs: Record<string, string> = {};
      Object.entries(firstAvailable.attributes || {}).forEach(([k, v]) => {
        initialAttrs[k] = String(v);
      });
      setSelectedAttributes(initialAttrs);
    }
  }, [variants, selectedAttributes]);

  // Find the variant that matches all selected attributes
  const selectedVariant = React.useMemo(() => {
    if (Object.keys(selectedAttributes).length === 0) return null;
    return (
      variants.find((v) => {
        return Object.entries(selectedAttributes).every(([key, value]) => {
          return String(v.attributes?.[key]) === value;
        });
      }) ?? null
    );
  }, [variants, selectedAttributes]);

  const hasPurchasableVariant = variants.some((variant) => variant.stock > 0);
  const disableControls = variants.length === 0 || !hasPurchasableVariant;
  const canAdd = !!selectedVariant && selectedVariant.stock > 0;

  async function onClick() {
    if (!selectedVariant) return;
    setStatus("loading");
    setMessage("");
    try {
      await add(selectedVariant.id, 1);
      setStatus("done");
      setMessage("Added to cart.");
    } catch {
      setStatus("error");
      setMessage("Failed to add item. Please try again.");
    }
  }

  const handleAttributeChange = (key: string, value: string) => {
    setSelectedAttributes((prev) => {
      const next = { ...prev, [key]: value };
      
      // Check if this new combination exists. If not, try to find a variant that matches the newly selected value
      const exists = variants.some((v) => {
        return Object.entries(next).every(([k, val]) => String(v.attributes?.[k]) === val);
      });

      if (!exists) {
        // Find first variant that matches the new value and as many other attributes as possible
        const matchingVariant = variants.find((v) => String(v.attributes?.[key]) === value) || variants[0];
        if (matchingVariant) {
          const newAttrs: Record<string, string> = {};
          Object.entries(matchingVariant.attributes || {}).forEach(([k, v]) => {
            newAttrs[k] = String(v);
          });
          return newAttrs;
        }
      }
      return next;
    });
  };

  if (variants.length === 0) {
    return (
      <div className="space-y-4">
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
    <div className="space-y-6">
      {/* Dynamic Price Display */}
      <div className="rounded-2xl border border-surface-border bg-background/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Price</h2>
        <p className="mt-1 text-3xl font-semibold">
          {(() => {
            if (selectedVariant) {
              return formatMoney(selectedVariant.priceCents, selectedVariant.currency);
            }
            if (variants.length > 0) {
              const prices = variants.map((v) => v.priceCents);
              const minPrice = Math.min(...prices);
              const maxPrice = Math.max(...prices);
              const currency = variants[0].currency;

              if (minPrice === maxPrice) {
                return formatMoney(minPrice, currency);
              }
              return `${formatMoney(minPrice, currency)} - ${formatMoney(maxPrice, currency)}`;
            }
            return "N/A";
          })()}
        </p>
      </div>

      {/* Attribute Selectors */}
      <div className="space-y-4">
        {allAttributes.keys.map((key) => (
          <div key={key} className="space-y-2">
            <span className="text-sm font-medium capitalize">{key}</span>
            <div className="flex flex-wrap gap-2">
              {allAttributes.values[key].map((value) => {
                const isSelected = selectedAttributes[key] === value;
                // Check if this value is available with current OTHER selections
                const isPossible = variants.some((v) => {
                  if (String(v.attributes?.[key]) !== value) return false;
                  // For other attributes, we don't strictly require a match to keep it interactive
                  // but we could mark it as "unavailable combination"
                  return true;
                });

                return (
                  <button
                    key={value}
                    onClick={() => handleAttributeChange(key, value)}
                    disabled={disableControls}
                    className={`
                      px-4 py-2 text-sm font-medium rounded-xl border transition-all
                      ${isSelected 
                        ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                        : "bg-surface border-surface-border hover:border-primary/50 text-neutral-600 dark:text-neutral-300"}
                      ${!isPossible ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Button
          onClick={onClick}
          size="lg"
          className="rounded-xl h-12 text-base font-semibold"
          disabled={status === "loading" || !canAdd || disableControls}
        >
          {status === "loading" ? "Adding..." : !hasPurchasableVariant ? "Out of Stock" : "Add to Cart"}
        </Button>

        {selectedVariant && selectedVariant.stock > 0 && selectedVariant.stock <= 5 && (
          <p className="text-center text-xs font-medium text-orange-600 dark:text-orange-400">
            Only {selectedVariant.stock} left in stock!
          </p>
        )}

        {message && (
          <p className={`text-center text-sm ${status === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
            {message}
          </p>
        )}
      </div>

      {!hasPurchasableVariant && (
        <div className="glass rounded-2xl border border-white/10 bg-background/60 p-4">
          <Chip size="sm" color="warning" variant="flat">
            Out of stock
          </Chip>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            All variants are currently out of stock.
          </p>
          <Button asChild variant="outline" className="mt-3 rounded-xl w-full">
            <Link href="/products">Back to products</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

