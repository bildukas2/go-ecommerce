"use client";

import * as React from "react";
import type { CheckoutPaymentMethod } from "@/lib/checkout-api";
import { Button } from "@/components/ui/button";
import { CreditCard, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentMethodSelectorProps {
  methods: CheckoutPaymentMethod[];
  selectedMethod: string | null;
  onSelect: (method: string) => void;
  onContinue: () => void;
  loading?: boolean;
  methodsLoading?: boolean;
  error?: string | null;
}

export function PaymentMethodSelector({
  methods,
  selectedMethod,
  onSelect,
  onContinue,
  loading,
  methodsLoading,
  error,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Payment Method</h3>
      </div>

      {methodsLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-surface-border bg-surface/70 p-8 text-foreground/60">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>Loading payment methods...</span>
        </div>
      ) : methods.length === 0 ? (
        <div className="text-sm text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          No payment methods available
        </div>
      ) : (
        <div className="grid gap-3">
          {methods.map((method) => (
            <button
              key={method.id}
              onClick={() => onSelect(method.method_name)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all",
                selectedMethod === method.method_name
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-border hover:border-blue-300 hover:bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  selectedMethod === method.method_name
                    ? "bg-blue-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{method.title}</div>
                {method.description && (
                  <div className="text-sm text-foreground/60">{method.description}</div>
                )}
              </div>
              {selectedMethod === method.method_name && (
                <Check className="h-5 w-5 text-blue-500" />
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          {error}
        </div>
      )}

      <Button
        onClick={onContinue}
        disabled={!selectedMethod || loading || methodsLoading}
        className="w-full sm:w-auto"
      >
        {loading ? "Processing..." : "Continue to Review"}
      </Button>
    </div>
  );
}