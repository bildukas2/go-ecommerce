"use client";

import { useState } from "react";
import type { ShippingProvider } from "@/lib/api";
import { updateShippingProvider } from "@/lib/api";

type Props = {
  provider: ShippingProvider | null;
  currentProviders: ShippingProvider[];
  onClose: () => void;
  onSuccess: (providers: ShippingProvider[]) => void;
};

export function ProviderForm({ provider, currentProviders, onClose, onSuccess }: Props) {
  const isCreating = !provider;
  const [name, setName] = useState(provider?.name ?? "");
  const [key, setKey] = useState(provider?.key ?? "");
  const [mode, setMode] = useState<"sandbox" | "live">(provider?.mode ?? "sandbox");
  const [enabled, setEnabled] = useState(provider?.enabled ?? false);
  const [configJson, setConfigJson] = useState(() => {
    if (!provider?.config_json) return "{}";
    try {
      return JSON.stringify(provider.config_json, null, 2);
    } catch {
      return "{}";
    }
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return false;
    }

    if (!key.trim()) {
      setError("Key is required");
      return false;
    }

    if (isCreating) {
      const keyExists = currentProviders.some((p) => p.key === key.trim());
      if (keyExists) {
        setError("A provider with this key already exists");
        return false;
      }
    }

    try {
      JSON.parse(configJson);
    } catch {
      setError("Config JSON is invalid");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const config = JSON.parse(configJson);
      const payload: Partial<ShippingProvider> = {
        name: name.trim(),
        mode,
        enabled,
        config_json: config,
      };

      if (isCreating) {
        payload.key = key.trim();
      }

      const updated = provider?.key
        ? await updateShippingProvider(provider.key, payload)
        : await updateShippingProvider(key.trim(), payload);

      if (provider) {
        const updatedProviders = currentProviders.map((p) => (p.id === provider.id ? updated : p));
        onSuccess(updatedProviders);
      } else {
        onSuccess([...currentProviders, updated]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save provider");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h2 className="text-lg font-semibold">{isCreating ? "Create Provider" : "Edit Provider"}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-foreground/[0.05] disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {error && (
            <div className="rounded-lg border border-red-500/35 bg-red-500/12 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <label className="space-y-1 text-sm">
            <span className="font-medium">Name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., DHL, UPS, FedEx"
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Key {!isCreating && "(read-only)"} *</span>
            <input
              type="text"
              value={key}
              onChange={(e) => isCreating && setKey(e.target.value)}
              placeholder="e.g., dhl, ups, fedex"
              disabled={!isCreating || isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm font-mono disabled:opacity-50"
              required
            />
            {!isCreating && <p className="text-xs text-foreground/60">Cannot be changed after creation</p>}
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Mode</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "sandbox" | "live")}
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="sandbox">Sandbox (testing)</option>
              <option value="live">Live (production)</option>
            </select>
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

          <label className="space-y-1 text-sm">
            <span className="font-medium">Config JSON (optional)</span>
            <textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              disabled={isLoading}
              rows={5}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 font-mono text-xs disabled:opacity-50"
              placeholder='{"api_key": "..."}'
            />
            <p className="text-xs text-foreground/60">Provider-specific configuration in JSON format</p>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 disabled:opacity-50 dark:text-blue-300"
          >
            {isLoading ? (isCreating ? "Creating..." : "Saving...") : isCreating ? "Create Provider" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
