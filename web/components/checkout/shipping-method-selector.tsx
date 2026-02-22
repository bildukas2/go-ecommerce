"use client";

import { useState, useEffect } from "react";
import { Truck, Loader2, MapPin } from "lucide-react";
import {
  getStorefrontShippingOptions,
  type StorefrontShippingMethod,
  type StorefrontShippingZone,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  country: string;
  cartValue?: number;
  cartWeightKg?: number;
  selectedMethodId?: string;
  onSelect: (method: StorefrontShippingMethod) => void;
  className?: string;
};

export function ShippingMethodSelector({
  country,
  cartValue,
  cartWeightKg,
  selectedMethodId,
  onSelect,
  className,
}: Props) {
  const [zone, setZone] = useState<StorefrontShippingZone | null>(null);
  const [methods, setMethods] = useState<StorefrontShippingMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!country) {
      setZone(null);
      setMethods([]);
      return;
    }

    const fetchOptions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getStorefrontShippingOptions({
          country,
          cart_value: cartValue,
          cart_weight_kg: cartWeightKg,
        });
        setZone(data.zone);
        setMethods(data.methods);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load shipping options");
        setZone(null);
        setMethods([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, [country, cartValue, cartWeightKg]);

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
        <Loader2 className="h-6 w-6 animate-spin text-foreground/50" />
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

  if (!zone || methods.length === 0) {
    return (
      <div className={cn("rounded-lg border border-surface-border p-4 text-center text-foreground/60", className)}>
        No shipping methods available for your location
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Shipping Method</h3>
        {zone && (
          <span className="text-xs text-foreground/50">
            Zone: {zone.name}
          </span>
        )}
      </div>

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
