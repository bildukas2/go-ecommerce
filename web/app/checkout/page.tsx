"use client";

import * as React from "react";
import { checkout, isBlockedIPError, type StorefrontShippingMethod } from "@/lib/api";
import type { Terminal } from "@/hooks/use-terminals";
import { Button } from "@/components/ui/button";
import { ShippingMethodSelector } from "@/components/checkout/shipping-method-selector";
import { TerminalPicker } from "@/components/checkout/terminal-picker";
import { MapPin, Check } from "lucide-react";

// Default country for demo - in production this would come from user settings or geo-IP
const DEFAULT_COUNTRY = "EE";

export default function CheckoutPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  
  // Shipping state
  const [selectedMethod, setSelectedMethod] = React.useState<StorefrontShippingMethod | null>(null);
  const [selectedTerminal, setSelectedTerminal] = React.useState<Terminal | null>(null);
  const [shippingCountry, setShippingCountry] = React.useState(DEFAULT_COUNTRY);

  const canProceed = React.useMemo(() => {
    if (!selectedMethod) return false;
    if (selectedMethod.requires_terminal && !selectedTerminal) return false;
    return true;
  }, [selectedMethod, selectedTerminal]);

  async function onCheckout() {
    if (!canProceed) {
      setError("Please select a shipping method" + 
        (selectedMethod?.requires_terminal ? " and a pickup terminal" : ""));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await checkout();
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      setError("No checkout URL returned");
    } catch (e: unknown) {
      if (isBlockedIPError(e)) {
        window.location.href = e.redirectTo;
        return;
      }
      const msg = e instanceof Error ? e.message : "Checkout failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const handleShippingMethodSelect = (method: StorefrontShippingMethod) => {
    setSelectedMethod(method);
    // Clear terminal if method doesn't require one
    if (!method.requires_terminal) {
      setSelectedTerminal(null);
    }
  };

  const handleTerminalSelect = (terminal: Terminal) => {
    setSelectedTerminal(terminal);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Select your shipping method and proceed to payment.
        </p>
      </div>

      {/* Country selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Shipping Country</label>
        <select
          value={shippingCountry}
          onChange={(e) => {
            setShippingCountry(e.target.value);
            setSelectedMethod(null);
            setSelectedTerminal(null);
          }}
          className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm"
        >
          <option value="EE">Estonia</option>
          <option value="LV">Latvia</option>
          <option value="LT">Lithuania</option>
          <option value="FI">Finland</option>
        </select>
      </div>

      {/* Shipping method selector */}
      <ShippingMethodSelector
        country={shippingCountry}
        selectedMethodId={selectedMethod?.id}
        onSelect={handleShippingMethodSelect}
      />

      {/* Terminal picker - shown when method requires terminal */}
      {selectedMethod?.requires_terminal && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold">Select Pickup Terminal</h3>
          </div>
          <TerminalPicker
            provider={selectedMethod.provider_key}
            country={shippingCountry}
            selectedTerminalId={selectedTerminal?.id}
            onSelect={handleTerminalSelect}
          />
          {selectedTerminal && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-700 dark:text-green-300">
              <Check className="h-4 w-4" />
              <span>
                Selected: <strong>{selectedTerminal.name}</strong> - {selectedTerminal.address}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Proceed button */}
      <div className="pt-4 border-t border-surface-border">
        <Button 
          onClick={onCheckout} 
          disabled={loading || !canProceed}
          className="w-full"
        >
          {loading ? "Redirecting..." : "Proceed to Payment"}
        </Button>
        {!canProceed && selectedMethod?.requires_terminal && !selectedTerminal && (
          <p className="text-xs text-center text-foreground/50 mt-2">
            Please select a pickup terminal to continue
          </p>
        )}
      </div>
    </div>
  );
}
