
"use client";

import { useState } from "react";
import type { ShippingMethod, ShippingProvider, ShippingZone } from "@/lib/api";
import { createShippingMethod, updateShippingMethod } from "@/lib/api";

type Props = {
  method: ShippingMethod | null;
  currentMethods: ShippingMethod[];
  onClose: () => void;
  onSuccess: (methods: ShippingMethod[]) => void;
  zones: ShippingZone[];
  providers: ShippingProvider[];
};

type PricingMode = "flat" | "free" | "total_tiers" | "weight_tiers" | "provider";
type FreeMode = "always" | "over";
type TierRow = { min: string; max: string; price: string };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function normalizePricingMode(mode: string | undefined): PricingMode {
  const v = (mode ?? "").toLowerCase();
  if (v === "fixed") return "flat";
  if (v === "table") return "weight_tiers";
  if (v === "free" || v === "total_tiers" || v === "weight_tiers" || v === "provider") return v;
  return "flat";
}

function toMoneyInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseMoneyToCents(value: string): number | null {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function parseNonNegative(value: string): number | null {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function parseMoneyTiers(rules: Record<string, unknown>): TierRow[] {
  const tiers = asArray(rules.tiers)
    .map((item) => asRecord(item))
    .map((tier) => {
      const min = asNumber(tier.min);
      const max = asNumber(tier.max);
      const price = asNumber(tier.price);
      if (min === null || price === null) return null;
      return {
        min: toMoneyInput(min),
        max: max === null ? "" : toMoneyInput(max),
        price: toMoneyInput(price),
      };
    })
    .filter((tier): tier is TierRow => tier !== null);
  return tiers.length > 0 ? tiers : [{ min: "0.00", max: "", price: "0.00" }];
}

function parseWeightTiers(rules: Record<string, unknown>): TierRow[] {
  const tiers = asArray(rules.tiers)
    .map((item) => asRecord(item))
    .map((tier) => {
      const min = asNumber(tier.min);
      const max = asNumber(tier.max);
      const price = asNumber(tier.price);
      if (min === null || price === null) return null;
      return {
        min: String(min),
        max: max === null ? "" : String(max),
        price: toMoneyInput(price),
      };
    })
    .filter((tier): tier is TierRow => tier !== null);
  return tiers.length > 0 ? tiers : [{ min: "0", max: "", price: "0.00" }];
}

export function MethodForm({
  method,
  currentMethods,
  onClose,
  onSuccess,
  zones,
  providers,
}: Props) {
  const isCreating = !method;
  const rules = asRecord(method?.pricing_rules_json);
  const [zoneId, setZoneId] = useState(method?.zone_id ?? "");
  const [providerKey, setProviderKey] = useState(method?.provider_key ?? "");
  const [serviceCode, setServiceCode] = useState(method?.service_code ?? "");
  const [title, setTitle] = useState(method?.title ?? "");
  const [pricingMode, setPricingMode] = useState<PricingMode>(normalizePricingMode(method?.pricing_mode));
  const [flatPrice, setFlatPrice] = useState(asNumber(rules.price) === null ? "0.00" : toMoneyInput(asNumber(rules.price) as number));
  const [flatFreeOverEnabled, setFlatFreeOverEnabled] = useState(asNumber(rules.freeOver) !== null);
  const [flatFreeOver, setFlatFreeOver] = useState(asNumber(rules.freeOver) === null ? "" : toMoneyInput(asNumber(rules.freeOver) as number));
  const [freeMode, setFreeMode] = useState<FreeMode>(rules.always === true ? "always" : "over");
  const [freeOver, setFreeOver] = useState(asNumber(rules.freeOver) === null ? "" : toMoneyInput(asNumber(rules.freeOver) as number));
  const [totalTiers, setTotalTiers] = useState<TierRow[]>(parseMoneyTiers(rules));
  const [weightTiers, setWeightTiers] = useState<TierRow[]>(parseWeightTiers(rules));
  const [providerLiveRates, setProviderLiveRates] = useState(rules.liveRates === true);
  const [providerMarkupFixed, setProviderMarkupFixed] = useState(asNumber(rules.markupFixed) === null ? "" : toMoneyInput(asNumber(rules.markupFixed) as number));
  const [providerMarkupPercent, setProviderMarkupPercent] = useState(asNumber(rules.markupPercent) === null ? "" : String(asNumber(rules.markupPercent)));
  const [providerMinPrice, setProviderMinPrice] = useState(asNumber(rules.minPrice) === null ? "" : toMoneyInput(asNumber(rules.minPrice) as number));
  const [providerMaxPrice, setProviderMaxPrice] = useState(asNumber(rules.maxPrice) === null ? "" : toMoneyInput(asNumber(rules.maxPrice) as number));
  const [advancedEnabled, setAdvancedEnabled] = useState(false);
  const [pricingRulesJson, setPricingRulesJson] = useState(method ? JSON.stringify(method.pricing_rules_json, null, 2) : "");
  const [sortOrder, setSortOrder] = useState(method?.sort_order ?? 0);
  const [enabled, setEnabled] = useState(method?.enabled ?? true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const setTotalTier = (index: number, patch: Partial<TierRow>) => {
    const next = [...totalTiers];
    next[index] = { ...next[index], ...patch };
    setTotalTiers(next);
  };
  const setWeightTier = (index: number, patch: Partial<TierRow>) => {
    const next = [...weightTiers];
    next[index] = { ...next[index], ...patch };
    setWeightTiers(next);
  };

  const buildPricingRules = (): Record<string, unknown> | null => {
    if (pricingMode === "flat") {
      const price = parseMoneyToCents(flatPrice);
      if (price === null) return setError("Flat rate price must be a valid non-negative amount"), null;
      const out: Record<string, unknown> = { price };
      if (flatFreeOverEnabled) {
        const freeOver = parseMoneyToCents(flatFreeOver);
        if (freeOver === null) return setError("Free shipping threshold must be a valid non-negative amount"), null;
        out.freeOver = freeOver;
      }
      return out;
    }

    if (pricingMode === "free") {
      if (freeMode === "always") return { always: true };
      const freeOverCents = parseMoneyToCents(freeOver);
      if (freeOverCents === null) return setError("Free shipping threshold must be a valid non-negative amount"), null;
      return { freeOver: freeOverCents };
    }

    if (pricingMode === "total_tiers") {
      if (totalTiers.length === 0) return setError("Add at least one order total tier"), null;
      const tiers: Record<string, unknown>[] = [];
      for (let i = 0; i < totalTiers.length; i += 1) {
        const row = totalTiers[i];
        const min = parseMoneyToCents(row.min);
        const max = row.max.trim() ? parseMoneyToCents(row.max) : null;
        const price = parseMoneyToCents(row.price);
        if (min === null) return setError(`Order total tier ${i + 1}: invalid From`), null;
        if (price === null) return setError(`Order total tier ${i + 1}: invalid Price`), null;
        if (row.max.trim() && max === null) return setError(`Order total tier ${i + 1}: invalid To`), null;
        if (max !== null && max < min) return setError(`Order total tier ${i + 1}: To must be >= From`), null;
        const tier: Record<string, unknown> = { min, price };
        if (max !== null) tier.max = max;
        tiers.push(tier);
      }
      return { tiers };
    }

    if (pricingMode === "weight_tiers") {
      if (weightTiers.length === 0) return setError("Add at least one weight tier"), null;
      const tiers: Record<string, unknown>[] = [];
      for (let i = 0; i < weightTiers.length; i += 1) {
        const row = weightTiers[i];
        const min = parseNonNegative(row.min);
        const max = row.max.trim() ? parseNonNegative(row.max) : null;
        const price = parseMoneyToCents(row.price);
        if (min === null) return setError(`Weight tier ${i + 1}: invalid From`), null;
        if (price === null) return setError(`Weight tier ${i + 1}: invalid Price`), null;
        if (row.max.trim() && max === null) return setError(`Weight tier ${i + 1}: invalid To`), null;
        if (max !== null && max < min) return setError(`Weight tier ${i + 1}: To must be >= From`), null;
        const tier: Record<string, unknown> = { min, price };
        if (max !== null) tier.max = max;
        tiers.push(tier);
      }
      return { unit: "kg", tiers };
    }

    const out: Record<string, unknown> = { liveRates: providerLiveRates };
    const markupFixed = providerMarkupFixed.trim() ? parseMoneyToCents(providerMarkupFixed) : null;
    const markupPercent = providerMarkupPercent.trim() ? parseNonNegative(providerMarkupPercent) : null;
    const minPrice = providerMinPrice.trim() ? parseMoneyToCents(providerMinPrice) : null;
    const maxPrice = providerMaxPrice.trim() ? parseMoneyToCents(providerMaxPrice) : null;
    if (providerMarkupFixed.trim() && markupFixed === null) return setError("Provider +EUR markup is invalid"), null;
    if (providerMarkupPercent.trim() && markupPercent === null) return setError("Provider +% markup is invalid"), null;
    if (providerMinPrice.trim() && minPrice === null) return setError("Provider minimum price is invalid"), null;
    if (providerMaxPrice.trim() && maxPrice === null) return setError("Provider maximum price is invalid"), null;
    if (minPrice !== null && maxPrice !== null && maxPrice < minPrice) return setError("Maximum price must be >= minimum price"), null;
    if (markupFixed !== null) out.markupFixed = markupFixed;
    if (markupPercent !== null) out.markupPercent = markupPercent;
    if (minPrice !== null) out.minPrice = minPrice;
    if (maxPrice !== null) out.maxPrice = maxPrice;
    return out;
  };

  const validateForm = (): { pricingRules: Record<string, unknown> } | null => {
    setError("");
    if (!zoneId.trim()) return setError("Zone is required"), null;
    if (!providerKey.trim()) return setError("Provider is required"), null;
    if (!serviceCode.trim()) return setError("Service Code is required"), null;
    if (!title.trim()) return setError("Title is required"), null;

    const isUnique = !currentMethods.some(
      (m) => m.zone_id === zoneId && m.provider_key === providerKey && m.service_code === serviceCode && m.id !== method?.id
    );
    if (!isUnique) return setError("This zone + provider + service code combination already exists"), null;

    const generated = buildPricingRules();
    if (!generated) return null;

    if (advancedEnabled && pricingRulesJson.trim()) {
      try {
        const parsed = JSON.parse(pricingRulesJson);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          return setError("Advanced JSON rules must be a JSON object"), null;
        }
        return { pricingRules: parsed as Record<string, unknown> };
      } catch {
        return setError("Advanced JSON rules are invalid"), null;
      }
    }
    return { pricingRules: generated };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validated = validateForm();
    if (!validated) return;

    setIsLoading(true);
    try {
      const payload = {
        zone_id: zoneId,
        provider_key: providerKey,
        service_code: serviceCode.trim(),
        title: title.trim(),
        pricing_mode: pricingMode as ShippingMethod["pricing_mode"],
        pricing_rules_json: validated.pricingRules,
        sort_order: sortOrder,
        enabled,
      };

      let result: ShippingMethod;
      if (isCreating) {
        result = await createShippingMethod(payload);
        onSuccess([...currentMethods, result]);
      } else if (method) {
        result = await updateShippingMethod(method.id, payload);
        onSuccess(currentMethods.map((m) => (m.id === method.id ? result : m)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save method");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
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

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-4">
          {error && <div className="rounded-lg border border-red-500/35 bg-red-500/12 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

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

          <label className="space-y-1 text-sm">
            <span className="font-medium">Pricing Mode *</span>
            <select
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as PricingMode)}
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="flat">Flat rate</option>
              <option value="free">Free shipping</option>
              <option value="total_tiers">By order total (tiered)</option>
              <option value="weight_tiers">By weight (tiered)</option>
              <option value="provider">Provider rate</option>
            </select>
          </label>

          {pricingMode === "flat" && (
            <div className="space-y-3 rounded-xl border border-surface-border bg-foreground/[0.02] p-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Price (EUR) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={flatPrice}
                  onChange={(e) => setFlatPrice(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={flatFreeOverEnabled}
                  onChange={(e) => setFlatFreeOverEnabled(e.target.checked)}
                  disabled={isLoading}
                  className="rounded"
                />
                <span>Free shipping over threshold</span>
              </label>
              {flatFreeOverEnabled && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={flatFreeOver}
                  onChange={(e) => setFlatFreeOver(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
              )}
            </div>
          )}

          {pricingMode === "free" && (
            <div className="space-y-3 rounded-xl border border-surface-border bg-foreground/[0.02] p-3">
              <select
                value={freeMode}
                onChange={(e) => setFreeMode(e.target.value as FreeMode)}
                disabled={isLoading}
                className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="always">Always free</option>
                <option value="over">Free over order threshold</option>
              </select>
              {freeMode === "over" && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={freeOver}
                  onChange={(e) => setFreeOver(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
              )}
            </div>
          )}

          {pricingMode === "total_tiers" && (
            <div className="space-y-3 rounded-xl border border-surface-border bg-foreground/[0.02] p-3">
              <div className="overflow-x-auto rounded-lg border border-surface-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-surface-border bg-foreground/[0.03]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">From (EUR)</th>
                      <th className="px-3 py-2 text-left font-medium">To (EUR)</th>
                      <th className="px-3 py-2 text-left font-medium">Price (EUR)</th>
                      <th className="px-3 py-2 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalTiers.map((tier, index) => (
                      <tr key={`total-${index}`} className="border-b border-surface-border/50">
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={tier.min} onChange={(e) => setTotalTier(index, { min: e.target.value })} disabled={isLoading} className="w-full rounded-lg border border-surface-border bg-background px-2 py-1.5 text-sm disabled:opacity-50" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" placeholder="Leave blank for infinity" value={tier.max} onChange={(e) => setTotalTier(index, { max: e.target.value })} disabled={isLoading} className="w-full rounded-lg border border-surface-border bg-background px-2 py-1.5 text-sm disabled:opacity-50" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={tier.price} onChange={(e) => setTotalTier(index, { price: e.target.value })} disabled={isLoading} className="w-full rounded-lg border border-surface-border bg-background px-2 py-1.5 text-sm disabled:opacity-50" />
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setTotalTiers(totalTiers.filter((_, idx) => idx !== index))} disabled={isLoading || totalTiers.length === 1} className="rounded-lg border border-red-500/35 bg-red-500/10 px-2 py-1 text-xs text-red-700 hover:bg-red-500/15 disabled:opacity-50 dark:text-red-300">
                            Remove row
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setTotalTiers([...totalTiers, { min: "0.00", max: "", price: "0.00" }])} disabled={isLoading} className="rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-foreground/[0.05] disabled:opacity-50">
                Add tier
              </button>
            </div>
          )}

          {pricingMode === "weight_tiers" && (
            <div className="space-y-3 rounded-xl border border-surface-border bg-foreground/[0.02] p-3">
              <div className="overflow-x-auto rounded-lg border border-surface-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-surface-border bg-foreground/[0.03]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">From (kg)</th>
                      <th className="px-3 py-2 text-left font-medium">To (kg)</th>
                      <th className="px-3 py-2 text-left font-medium">Price (EUR)</th>
                      <th className="px-3 py-2 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weightTiers.map((tier, index) => (
                      <tr key={`weight-${index}`} className="border-b border-surface-border/50">
                        <td className="px-3 py-2">
                          <input type="number" step="0.001" min="0" value={tier.min} onChange={(e) => setWeightTier(index, { min: e.target.value })} disabled={isLoading} className="w-full rounded-lg border border-surface-border bg-background px-2 py-1.5 text-sm disabled:opacity-50" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.001" min="0" placeholder="Leave blank for infinity" value={tier.max} onChange={(e) => setWeightTier(index, { max: e.target.value })} disabled={isLoading} className="w-full rounded-lg border border-surface-border bg-background px-2 py-1.5 text-sm disabled:opacity-50" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={tier.price} onChange={(e) => setWeightTier(index, { price: e.target.value })} disabled={isLoading} className="w-full rounded-lg border border-surface-border bg-background px-2 py-1.5 text-sm disabled:opacity-50" />
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setWeightTiers(weightTiers.filter((_, idx) => idx !== index))} disabled={isLoading || weightTiers.length === 1} className="rounded-lg border border-red-500/35 bg-red-500/10 px-2 py-1 text-xs text-red-700 hover:bg-red-500/15 disabled:opacity-50 dark:text-red-300">
                            Remove row
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setWeightTiers([...weightTiers, { min: "0", max: "", price: "0.00" }])} disabled={isLoading} className="rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-foreground/[0.05] disabled:opacity-50">
                Add tier
              </button>
            </div>
          )}

          {pricingMode === "provider" && (
            <div className="space-y-3 rounded-xl border border-surface-border bg-foreground/[0.02] p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={providerLiveRates} onChange={(e) => setProviderLiveRates(e.target.checked)} disabled={isLoading} className="rounded" />
                <span>Use provider live rates</span>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <input type="number" step="0.01" min="0" placeholder="+EUR fixed" value={providerMarkupFixed} onChange={(e) => setProviderMarkupFixed(e.target.value)} disabled={isLoading} className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50" />
                <input type="number" step="0.01" min="0" placeholder="+% percent" value={providerMarkupPercent} onChange={(e) => setProviderMarkupPercent(e.target.value)} disabled={isLoading} className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50" />
                <input type="number" step="0.01" min="0" placeholder="Minimum price (EUR)" value={providerMinPrice} onChange={(e) => setProviderMinPrice(e.target.value)} disabled={isLoading} className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50" />
                <input type="number" step="0.01" min="0" placeholder="Maximum price (EUR)" value={providerMaxPrice} onChange={(e) => setProviderMaxPrice(e.target.value)} disabled={isLoading} className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50" />
              </div>
            </div>
          )}

          <details className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-medium">Advanced (JSON rules)</summary>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={advancedEnabled} onChange={(e) => setAdvancedEnabled(e.target.checked)} disabled={isLoading} className="rounded" />
                <span>Enable custom JSON override</span>
              </label>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90">For developers only. If provided, this JSON overrides builder output.</p>
              {advancedEnabled && (
                <textarea
                  value={pricingRulesJson}
                  onChange={(e) => setPricingRulesJson(e.target.value)}
                  rows={8}
                  placeholder='{"price":499,"freeOver":10000}'
                  disabled={isLoading}
                  className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 font-mono text-xs disabled:opacity-50"
                />
              )}
            </div>
          </details>

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
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={isLoading} className="rounded" />
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
