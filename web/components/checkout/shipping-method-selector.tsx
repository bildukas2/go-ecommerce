"use client";

import { Truck, MapPin } from "lucide-react";
import type { CheckoutShippingMethod } from "@/lib/checkout-api";
import { cn } from "@/lib/utils";

type Props = {
  country: string;
  methods: CheckoutShippingMethod[];
  isLoading: boolean;
  error?: string | null;
  selectedMethodId?: string;
  onSelect: (method: CheckoutShippingMethod) => void;
  className?: string;
};

export function ShippingMethodSelector({
  country,
  methods,
  isLoading,
  error,
  selectedMethodId,
  onSelect,
  className,
}: Props) {

  if (!country) {
    return (
      <div className={cn("rounded-lg border border-surface-border p-4 text-center text-foreground/60", className)}>
        Enter your shipping country to see available shipping methods
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <svg className="h-6 w-6 animate-spin text-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-2 text-foreground/60">Loading shipping options...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300", className)}>
        {error}
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className={cn("rounded-lg border border-surface-border p-4 text-center text-foreground/60", className)}>
        No shipping methods available for your location
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Methods list */}
      <div className="space-y-2">
        {methods.map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => onSelect(method)}
            className={cn(
              "w-full rounded-lg border p-4 text-left transition-all",
              selectedMethodId === method.id
                ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                : "border-surface-border bg-background hover:bg-foreground/[0.02] hover:border-foreground/20"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 shrink-0 text-foreground/50" />
                  <h4 className="font-medium truncate">{method.title}</h4>
                  {selectedMethodId === method.id && (
                    <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                      Selected
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-foreground/60">
                  <span className="capitalize">{method.provider_key}</span>
                  {method.requires_terminal && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Terminal pickup
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-lg font-semibold">
                  {method.price === 0 ? "Free" : formatPrice(method.price, method.currency)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount);
}
