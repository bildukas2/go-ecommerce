"use client";

import * as React from "react";
import { PAYMENT_METHODS } from "@/lib/checkout-api";
import { Button } from "@/components/ui/button";
import { CreditCard, Building2, Banknote, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentMethodSelectorProps {
  selectedMethod: string | null;
  onSelect: (method: string) => void;
  onContinue: () => void;
  loading?: boolean;
  error?: string | null;
}

const methodIcons: Record<string, React.ReactNode> = {
  card: <CreditCard className="h-5 w-5" />,
  banklink: <Building2 className="h-5 w-5" />,
  cash_on_delivery: <Banknote className="h-5 w-5" />,
};

export function PaymentMethodSelector({
  selectedMethod,
  onSelect,
  onContinue,
  loading,
  error,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Payment Method</h3>
      </div>

      <div className="grid gap-3">
        {PAYMENT_METHODS.map((method) => (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            className={cn(
              "flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all",
              selectedMethod === method.id
                ? "border-blue-500 bg-blue-500/5"
                : "border-border hover:border-blue-300 hover:bg-muted/50"
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                selectedMethod === method.id
                  ? "bg-blue-500 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {methodIcons[method.id]}
            </div>
            <div className="flex-1">
              <div className="font-medium">{method.title}</div>
            </div>
            {selectedMethod === method.id && (
              <Check className="h-5 w-5 text-blue-500" />
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          {error}
        </div>
      )}

      <Button
        onClick={onContinue}
        disabled={!selectedMethod || loading}
        className="w-full sm:w-auto"
      >
        {loading ? "Processing..." : "Continue to Review"}
      </Button>
    </div>
  );
}