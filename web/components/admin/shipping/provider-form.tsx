"use client";

import { useEffect, useState } from "react";
import type { ShippingProvider, ShippingProviderPlugin } from "@/lib/api";
import { updateShippingProvider } from "@/lib/api";
import { ProviderConfig } from "./provider-configs";

type Props = {
  provider: ShippingProvider | null;
  currentProviders: ShippingProvider[];
  availablePlugins: ShippingProviderPlugin[];
  onClose: () => void;
  onSuccess: (providers: ShippingProvider[]) => void;
};

export function ProviderForm({ provider, currentProviders, availablePlugins, onClose, onSuccess }: Props) {
  const isCreating = !provider;
  const hasAvailablePlugins = availablePlugins.length > 0;
  const [name, setName] = useState(provider?.name ?? "");
  const [key, setKey] = useState(provider?.key ?? "");
  const [mode, setMode] = useState<"sandbox" | "live">(provider?.mode ?? "sandbox");
  const [enabled, setEnabled] = useState(provider?.enabled ?? false);
  const [configJson, setConfigJson] = useState<Record<string, unknown>>(() => {
    if (!provider?.config_json) return {};
    return provider.config_json;
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isCreating) return;
    if (availablePlugins.length !== 1) return;
    if (key.trim()) return;
    const onlyPlugin = availablePlugins[0];
    setKey(onlyPlugin.key);
    setName((currentName) => (currentName.trim() ? currentName : onlyPlugin.name));
  }, [availablePlugins, isCreating, key]);

  const validateForm = (): boolean => {
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return false;
    }

    if (!key.trim()) {
      setError(isCreating && !hasAvailablePlugins ? "No shipping plugins are available. Add a plugin to continue." : "Plugin is required");
      return false;
    }

    if (isCreating) {
      const keyExists = currentProviders.some((p) => p.key === key.trim());
      if (keyExists) {
        setError("A provider with this key already exists");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const payload: Partial<ShippingProvider> = {
        name: name.trim(),
        mode,
        enabled,
        config_json: configJson,
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

  const handlePluginSelect = (pluginKey: string) => {
    setKey(pluginKey);
    const plugin = availablePlugins.find((item) => item.key === pluginKey);
    if (!plugin) return;
    setName((currentName) => (currentName.trim() ? currentName : plugin.name));
  };

  const isSubmitDisabled =
    isLoading ||
    (isCreating && (!hasAvailablePlugins || !key.trim()));

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

        <form onSubmit={handleSubmit} className="space-y-4 p-4 max-h-[70vh] overflow-y-auto">
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
              placeholder="e.g., Omniva, DPD, Venipak"
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            />
          </label>

          {isCreating ? (
            <label className="space-y-1 text-sm">
              <span className="font-medium">Plugin *</span>
              <select
                value={key}
                onChange={(e) => handlePluginSelect(e.target.value)}
                disabled={isLoading || !hasAvailablePlugins}
                className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                required
              >
                <option value="">Select a plugin...</option>
                {availablePlugins.map((plugin) => (
                  <option key={plugin.key} value={plugin.key}>
                    {plugin.name} ({plugin.key})
                  </option>
                ))}
              </select>
              {!hasAvailablePlugins && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  No shipping plugins are available. Configure a plugin package first.
                </p>
              )}
            </label>
          ) : (
            <label className="space-y-1 text-sm">
              <span className="font-medium">Key (read-only) *</span>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g., omniva, dpd, venipak"
                disabled={isLoading}
                className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm font-mono disabled:opacity-50"
                required
              />
              <p className="text-xs text-foreground/60">Cannot be changed after creation</p>
            </label>
          )}

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

          <div className="border-t border-surface-border pt-4">
            <ProviderConfig
              providerKey={key.trim()}
              configJson={configJson}
              onChange={setConfigJson}
              mode={mode}
              onModeChange={setMode}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full rounded-lg border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 disabled:opacity-50 dark:text-blue-300"
          >
            {isLoading ? (isCreating ? "Creating..." : "Saving...") : isCreating ? "Create Provider" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
