"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { PaymentMethod, BankTransferConfig, ShippingMethod } from "@/lib/api";
import { createPaymentMethod } from "@/lib/api";
import { BankTransferConfigForm } from "./bank-transfer-config-form";

type Props = {
  currentMethods: PaymentMethod[];
  shippingMethods: ShippingMethod[];
  onBack: () => void;
  onSuccess: (methods: PaymentMethod[]) => void;
};

export function BankTransferForm({
  currentMethods,
  shippingMethods,
  onBack,
  onSuccess,
}: Props) {
  const [key, setKey] = useState("bank_transfer");
  const [title, setTitle] = useState("Direct Bank Transfer");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [bankConfig, setBankConfig] = useState<BankTransferConfig>({
    account_name: "",
    account_number: "",
    bank_name: "",
    sort_code: "",
    iban: "",
    bic_swift: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    setError("");

    if (!key.trim()) {
      setError("Payment method key is required");
      return false;
    }

    if (!title.trim()) {
      setError("Title is required");
      return false;
    }

    if (!bankConfig.account_name.trim()) {
      setError("Account holder name is required");
      return false;
    }

    return true;
  };

  const buildConfigJson = (): Record<string, unknown> => {
    const config: Record<string, unknown> = {
      account_name: bankConfig.account_name.trim(),
      account_number: bankConfig.account_number.trim(),
      bank_name: bankConfig.bank_name.trim(),
    };
    if (bankConfig.sort_code?.trim()) config.sort_code = bankConfig.sort_code.trim();
    if (bankConfig.iban?.trim()) config.iban = bankConfig.iban.trim();
    if (bankConfig.bic_swift?.trim()) config.bic_swift = bankConfig.bic_swift.trim();
    return config;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const result = await createPaymentMethod({
        key: key.trim(),
        method_name: "bank_transfer",
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        payment_type: "manual",
        enabled,
        sort_order: sortOrder,
        config_json: buildConfigJson(),
      });
      onSuccess([...currentMethods, result]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment method");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {error && (
          <div className="rounded-lg border border-red-500/35 bg-red-500/12 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Key (Identifier) *</span>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            />
          </label>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            rows={2}
            className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Instructions</span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={isLoading}
            rows={3}
            className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Sort Order</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={isLoading}
              className="rounded border border-surface-border"
            />
            <span className="font-medium">Enabled</span>
          </label>
        </div>

        <BankTransferConfigForm
          config={bankConfig}
          onChange={setBankConfig}
          disabled={isLoading}
        />
      </div>

      <div className="flex items-center justify-between border-t border-surface-border p-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-foreground/[0.05] disabled:opacity-50"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-500/18 disabled:opacity-50 dark:text-blue-300"
        >
          {isLoading ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}
