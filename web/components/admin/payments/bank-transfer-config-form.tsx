"use client";

import type { BankTransferConfig } from "@/lib/api";

type Props = {
  config: BankTransferConfig;
  onChange: (config: BankTransferConfig) => void;
  disabled?: boolean;
};

export function BankTransferConfigForm({ config, onChange, disabled }: Props) {
  const handleChange = (field: keyof BankTransferConfig, value: string) => {
    onChange({
      ...config,
      [field]: value || undefined,
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-surface-border bg-foreground/[0.02] p-4">
      <div>
        <h4 className="text-sm font-semibold mb-4">Bank Transfer Details</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Account Holder Name *</span>
            <input
              type="text"
              value={config.account_name || ""}
              onChange={(e) => handleChange("account_name", e.target.value)}
              placeholder="Company or individual name"
              disabled={disabled}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Account Number</span>
            <input
              type="text"
              value={config.account_number || ""}
              onChange={(e) => handleChange("account_number", e.target.value)}
              placeholder="e.g., 12345678"
              disabled={disabled}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Bank Name</span>
            <input
              type="text"
              value={config.bank_name || ""}
              onChange={(e) => handleChange("bank_name", e.target.value)}
              placeholder="e.g., Example Bank"
              disabled={disabled}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Sort Code</span>
            <input
              type="text"
              value={config.sort_code || ""}
              onChange={(e) => handleChange("sort_code", e.target.value)}
              placeholder="e.g., 12-34-56"
              disabled={disabled}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-foreground/60">UK sort codes are 6 digits (usually formatted XX-XX-XX)</p>
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium">IBAN</span>
            <input
              type="text"
              value={config.iban || ""}
              onChange={(e) => handleChange("iban", e.target.value)}
              placeholder="e.g., GB82 WEST 1234 5678 9012 34"
              disabled={disabled}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-foreground/60">International Bank Account Number</p>
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium">BIC / SWIFT Code</span>
            <input
              type="text"
              value={config.bic_swift || ""}
              onChange={(e) => handleChange("bic_swift", e.target.value)}
              placeholder="e.g., WESTGB22"
              disabled={disabled}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-foreground/60">Bank Identifier Code</p>
          </label>
        </div>
      </div>
    </div>
  );
}
