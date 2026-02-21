"use client";

import { useState } from "react";
import type { ShippingMethod, ShippingZone, ShippingProvider } from "@/lib/api";
import { updateShippingMethod, createShippingMethod } from "@/lib/api";

type Props = {
  method: ShippingMethod | null;
  currentMethods: ShippingMethod[];
  onClose: () => void;
  onSuccess: (methods: ShippingMethod[]) => void;
  zones: ShippingZone[];
  providers: ShippingProvider[];
};

export function MethodForm({
  method,
  currentMethods,
  onClose,
  onSuccess,
  zones,
  providers,
}: Props) {
  const isCreating = !method;
  const [zoneId, setZoneId] = useState(method?.zone_id ?? "");
  const [providerKey, setProviderKey] = useState(method?.provider_key ?? "");
  const [serviceCode, setServiceCode] = useState(method?.service_code ?? "");
  const [title, setTitle] = useState(method?.title ?? "");
  const [pricingMode, setPricingMode] = useState<"fixed" | "table" | "provider">(method?.pricing_mode ?? "fixed");
  const [pricingRulesJson, setPricingRulesJson] = useState(
    method ? JSON.stringify(method.pricing_rules_json, null, 2) : ""
  );
  const [sortOrder, setSortOrder] = useState(method?.sort_order ?? 0);
  const [enabled, setEnabled] = useState(method?.enabled ?? true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    setError("");

    if (!zoneId.trim()) {
      setError("Zone is required");
      return false;
    }

    if (!providerKey.trim()) {
      setError("Provider is required");
      return false;
    }

    if (!serviceCode.trim()) {
      setError("Service Code is required");
      return false;
    }

    if (!title.trim()) {
      setError("Title is required");
      return false;
    }

    if (!["fixed", "table", "provider"].includes(pricingMode)) {
      setError("Invalid pricing mode");
      return false;
    }

    if (pricingRulesJson.trim()) {
      try {
        JSON.parse(pricingRulesJson);
      } catch {
        setError("Pricing Rules JSON is invalid");
        return false;
      }
    }

    const isUnique = !currentMethods.some(
      (m) =>
        m.zone_id === zoneId &&
        m.provider_key === providerKey &&
        m.service_code === serviceCode &&
        m.id !== method?.id
    );

    if (!isUnique) {
      setError("This zone + provider + service code combination already exists");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      let pricingRulesJsonParsed: Record<string, unknown> = {};
      if (pricingRulesJson.trim()) {
        pricingRulesJsonParsed = JSON.parse(pricingRulesJson);
      }

      const payload = {
        zone_id: zoneId,
        provider_key: providerKey,
        service_code: serviceCode.trim(),
        title: title.trim(),
        pricing_mode: pricingMode,
        pricing_rules_json: pricingRulesJsonParsed,
        sort_order: sortOrder,
        enabled,
      };

      let result: ShippingMethod;
      if (isCreating) {
        result = await createShippingMethod(payload);
        onSuccess([...currentMethods, result]);
      } else if (method) {
        result = await updateShippingMethod(method.id, payload);
        const updatedMethods = currentMethods.map((m) => (m.id === method.id ? result : m));
        onSuccess(updatedMethods);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save method");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h2 className="text-lg font-semibold">{isCreating ? "Create Method" : "Edit Method"}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-foreground/[0.05] disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-4 flex-1">
          {error && (
            <div className="rounded-lg border border-red-500/35 bg-red-500/12 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <label className="space-y-1 text-sm">
            <span className="font-medium">Zone *</span>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            >
              <option value="">Select a zone...</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Provider *</span>
            <select
              value={providerKey}
              onChange={(e) => setProviderKey(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            >
              <option value="">Select a provider...</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.key}>
                  {provider.name} ({provider.key})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Service Code *</span>
            <input
              type="text"
              value={serviceCode}
              onChange={(e) => setServiceCode(e.target.value)}
              placeholder="e.g., express, standard"
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            />
            <p className="text-xs text-foreground/60">Provider-specific service code</p>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Express Delivery (2-3 days)"
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            />
            <p className="text-xs text-foreground/60">Display title for customers</p>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Pricing Mode *</span>
            <select
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as "fixed" | "table" | "provider")}
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            >
              <option value="fixed">Fixed (use pricing rules)</option>
              <option value="table">Table (weight/volume based)</option>
              <option value="provider">Provider (provider calculates)</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Pricing Rules JSON (optional)</span>
            <textarea
              value={pricingRulesJson}
              onChange={(e) => setPricingRulesJson(e.target.value)}
              placeholder='{"minWeight": 0, "maxWeight": 5, "price": 1000}'
              disabled={isLoading}
              rows={4}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-xs font-mono disabled:opacity-50"
            />
            <p className="text-xs text-foreground/60">JSON format for pricing rules (if needed)</p>
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
            <p className="text-xs text-foreground/60">Display order in checkout (lower = first)</p>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={isLoading}
              className="rounded"
            />
            <span>Enabled</span>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 disabled:opacity-50 dark:text-blue-300"
          >
            {isLoading ? (isCreating ? "Creating..." : "Saving...") : isCreating ? "Create Method" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
