"use client";

import { useState } from "react";
import type { PaymentMethod, BankTransferConfig } from "@/lib/api";
import { createPaymentMethod, updatePaymentMethod } from "@/lib/api";
import { BankTransferConfigForm } from "./bank-transfer-config-form";

type Props = {
  method: PaymentMethod | null;
  currentMethods: PaymentMethod[];
  onClose: () => void;
  onSuccess: (methods: PaymentMethod[]) => void;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function PaymentMethodForm({ method, currentMethods, onClose, onSuccess }: Props) {
  const isCreating = !method;
  const configObj = asRecord(method?.config_json);

  const [key, setKey] = useState(method?.key ?? "");
  const [title, setTitle] = useState(method?.title ?? "");
  const [description, setDescription] = useState(method?.description ?? "");
  const [instructions, setInstructions] = useState(method?.instructions ?? "");
  const [paymentType, setPaymentType] = useState<"manual" | "provider">(
    (method?.payment_type as "manual" | "provider") ?? "manual"
  );
  const [enabled, setEnabled] = useState(method?.enabled ?? false);
  const [sortOrder, setSortOrder] = useState(method?.sort_order ?? 0);
  const [bankConfig, setBankConfig] = useState<BankTransferConfig>({
    account_name: (configObj.account_name as string) || "",
    account_number: (configObj.account_number as string) || "",
    bank_name: (configObj.bank_name as string) || "",
    sort_code: (configObj.sort_code as string) || "",
    iban: (configObj.iban as string) || "",
    bic_swift: (configObj.bic_swift as string) || "",
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

    const isUnique = !currentMethods.some(
      (m) => m.key === key && m.id !== method?.id
    );

    if (!isUnique) {
      setError("A payment method with this key already exists");
      return false;
    }

    if (paymentType === "manual" && !bankConfig.account_name.trim()) {
      setError("Account holder name is required for bank transfer");
      return false;
    }

    return true;
  };

  const buildConfigJson = (): Record<string, unknown> => {
    if (paymentType === "manual") {
      const config: Record<string, unknown> = {
        account_name: bankConfig.account_name.trim(),
        account_number: bankConfig.account_number.trim(),
        bank_name: bankConfig.bank_name.trim(),
      };
      if (bankConfig.sort_code?.trim()) config.sort_code = bankConfig.sort_code.trim();
      if (bankConfig.iban?.trim()) config.iban = bankConfig.iban.trim();
      if (bankConfig.bic_swift?.trim()) config.bic_swift = bankConfig.bic_swift.trim();
      return config;
    }
    return {};
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const payload = {
        key: key.trim(),
        method_name: method?.method_name || "bank_transfer",
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        payment_type: paymentType,
        enabled,
        sort_order: sortOrder,
        config_json: buildConfigJson(),
      };

      let result: PaymentMethod;
      if (isCreating) {
        result = await createPaymentMethod(payload as Omit<PaymentMethod, "id" | "created_at" | "updated_at">);
        onSuccess([...currentMethods, result]);
      } else if (method) {
        result = await updatePaymentMethod(method.id, payload as Partial<PaymentMethod>);
        onSuccess(currentMethods.map((m) => (m.id === method.id ? result : m)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment method");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h2 className="text-lg font-semibold">
            {isCreating ? "Create Payment Method" : "Edit Payment Method"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-foreground/[0.05] disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-4">
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
                placeholder="e.g., bank_transfer"
                disabled={isLoading || !isCreating}
                className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                required
              />
              <p className="mt-1 text-xs text-foreground/60">
                Unique identifier (cannot be changed after creation)
              </p>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Title *</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Direct Bank Transfer"
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
              placeholder="Customer-facing description (shown on checkout)"
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
              placeholder="Instructions shown on checkout and order confirmation"
              disabled={isLoading}
              rows={3}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Payment Type *</span>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as "manual" | "provider")}
                disabled={isLoading}
                className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                required
              >
                <option value="manual">Manual (Bank Transfer)</option>
                <option value="provider">Provider (Payment Gateway)</option>
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Sort Order</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                disabled={isLoading}
                className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-foreground/60">Order in which methods appear (lower = first)</p>
            </label>
          </div>

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

          {paymentType === "manual" && (
            <BankTransferConfigForm
              config={bankConfig}
              onChange={setBankConfig}
              disabled={isLoading}
            />
          )}

          <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg border border-surface-border px-4 py-2 text-sm hover:bg-foreground/[0.05] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-500/18 disabled:opacity-50 dark:text-blue-300"
            >
              {isLoading ? "Saving..." : isCreating ? "Create" : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
