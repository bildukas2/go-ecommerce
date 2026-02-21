"use client";

import { useState } from "react";
import type { ShippingZone } from "@/lib/api";
import { updateShippingZone, createShippingZone } from "@/lib/api";

type Props = {
  zone: ShippingZone | null;
  currentZones: ShippingZone[];
  onClose: () => void;
  onSuccess: (zones: ShippingZone[]) => void;
};

export function ZoneForm({ zone, currentZones, onClose, onSuccess }: Props) {
  const isCreating = !zone;
  const [name, setName] = useState(zone?.name ?? "");
  const [countriesInput, setCountriesInput] = useState(
    zone?.countries_json ? zone.countries_json.join(",") : ""
  );
  const [enabled, setEnabled] = useState(zone?.enabled ?? true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return false;
    }

    const countries = countriesInput
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0);

    if (countries.length === 0) {
      setError("At least one country is required");
      return false;
    }

    if (countries.some((c) => c.length !== 2)) {
      setError("Countries must be 2-letter country codes (e.g., US, DE, FR)");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    const countries = countriesInput
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0);

    setIsLoading(true);
    try {
      const payload = {
        name: name.trim(),
        countries_json: countries,
        enabled,
      };

      let result: ShippingZone;
      if (isCreating) {
        result = await createShippingZone(payload);
        onSuccess([...currentZones, result]);
      } else if (zone) {
        result = await updateShippingZone(zone.id, payload);
        const updatedZones = currentZones.map((z) => (z.id === zone.id ? result : z));
        onSuccess(updatedZones);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save zone");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h2 className="text-lg font-semibold">{isCreating ? "Create Zone" : "Edit Zone"}</h2>
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
              placeholder="e.g., Europe, North America"
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              required
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Countries (comma-separated codes) *</span>
            <input
              type="text"
              value={countriesInput}
              onChange={(e) => setCountriesInput(e.target.value)}
              placeholder="e.g., US,DE,FR,GB"
              disabled={isLoading}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm font-mono uppercase disabled:opacity-50"
              required
            />
            <p className="text-xs text-foreground/60">
              Enter 2-letter ISO country codes separated by commas (e.g., US, DE, FR, GB)
            </p>
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
            {isLoading ? (isCreating ? "Creating..." : "Saving...") : isCreating ? "Create Zone" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
