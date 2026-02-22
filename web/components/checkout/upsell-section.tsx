"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";

interface UpsellSectionProps {
  onAdd?: (productId: string) => void;
}

const upsellProducts = [
  {
    id: "upsell-1",
    name: "Gift Wrapping",
    description: "Premium gift wrap with ribbon",
    price: 499,
  },
  {
    id: "upsell-2",
    name: "Extended Warranty",
    description: "2-year extended protection",
    price: 999,
  },
];

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export function UpsellSection({ onAdd }: UpsellSectionProps) {
  const [added, setAdded] = React.useState<Set<string>>(new Set());

  const handleAdd = (id: string) => {
    setAdded((prev) => new Set(prev).add(id));
    onAdd?.(id);
  };

  return (
    <div className="glass rounded-[28px] border border-surface-border bg-surface/70 p-6 space-y-4 shadow-[0_16px_40px_rgba(2,6,23,0.25)]">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-500" />
        <h3 className="text-lg font-semibold">Complete Your Order</h3>
      </div>

      <div className="space-y-3">
        {upsellProducts.map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between rounded-2xl border border-surface-border bg-background/70 px-4 py-3"
          >
            <div>
              <div className="font-medium text-sm">{product.name}</div>
              <div className="text-xs text-muted-foreground">
                {product.description}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {formatPrice(product.price)}
              </span>
              {added.has(product.id) ? (
                <span className="text-xs text-green-600 font-medium">Added ✓</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdd(product.id)}
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Special offers available at checkout only
      </p>
    </div>
  );
}