"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ShippingProvider, ShippingZone } from "@/lib/api";
import { getShippingTerminals, refreshShippingTerminals, deleteShippingTerminals } from "@/lib/api";
import { TerminalsRefreshButton } from "./terminals-refresh-button";

type Props = {
  initialProviders: ShippingProvider[];
  initialZones: ShippingZone[];
};

type CacheEntry = {
  provider: string;
  country: string;
  terminalCount: number;
  fetchedAt: string;
};

export function TerminalsList({ initialProviders, initialZones }: Props) {
  const [cacheEntries, setCacheEntries] = useState<CacheEntry[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<CacheEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>("");

  const enabledProviders = initialProviders.filter((p) => p.enabled);

  const getCountriesForProvider = (): string[] => {
    if (!selectedProvider) return [];
    const countries = new Set<string>();
    initialZones.forEach((zone) => {
      if (zone.enabled) {
        zone.countries_json.forEach((c) => countries.add(c));
      }
    });
    return Array.from(countries).sort();
  };

  const loadCacheStatus = async () => {
    if (!selectedProvider || !selectedCountry) {
      setLoadError("Please select both provider and country");
      return;
    }

    setIsLoadingList(true);
    setLoadError("");

    try {
      const data = await getShippingTerminals(selectedProvider, selectedCountry);
      const newEntry: CacheEntry = {
        provider: data.provider,
        country: data.country,
        terminalCount: data.terminals.length,
        fetchedAt: data.fetched_at,
      };

      setCacheEntries((prev) => {
        const filtered = prev.filter(
          (e) => !(e.provider === newEntry.provider && e.country === newEntry.country)
        );
        return [newEntry, ...filtered];
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load cache status";
      setLoadError(message);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleRefreshSuccess = (entry: CacheEntry) => {
    setCacheEntries((prev) => {
      const filtered = prev.filter(
        (e) => !(e.provider === entry.provider && e.country === entry.country)
      );
      return [entry, ...filtered];
    });
  };

  const handleDeleteClick = (entry: CacheEntry) => {
    setDeleteConfirm(entry);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    setDeleteLoading(true);
    try {
      await deleteShippingTerminals(deleteConfirm.provider, deleteConfirm.country);
      setCacheEntries((prev) =>
        prev.filter(
          (e) => !(e.provider === deleteConfirm.provider && e.country === deleteConfirm.country)
        )
      );
      setDeleteConfirm(null);
    } catch (error) {
      alert(`Failed to delete cache: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Terminals Cache Manager</h3>

        <div className="rounded-xl border border-surface-border bg-foreground/[0.02] p-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  setSelectedCountry("");
                }}
                className="mt-1.5 block w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm text-foreground placeholder-foreground/50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a provider...</option>
                {enabledProviders.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Country</label>
              {selectedProvider ? (
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm text-foreground placeholder-foreground/50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a country...</option>
                  {getCountriesForProvider().map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1.5 rounded-lg border border-surface-border bg-foreground/[0.05] px-3 py-2 text-sm text-foreground/50">
                  Select a provider first
                </div>
              )}
            </div>

            {loadError && (
              <div className="rounded-lg border border-red-200/50 bg-red-500/10 p-2 text-sm text-red-600 dark:text-red-400">
                {loadError}
              </div>
            )}

            <button
              onClick={loadCacheStatus}
              disabled={!selectedProvider || !selectedCountry || isLoadingList}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 disabled:opacity-50 dark:text-blue-300"
            >
              {isLoadingList ? "Loading..." : "Load Cache Status"}
            </button>
          </div>
        </div>

        {cacheEntries.length === 0 ? (
          <div className="rounded-xl border border-surface-border bg-foreground/[0.02] p-6 text-center text-foreground/70">
            <p>No cached terminals loaded. Select a provider and country above to load cache status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border bg-foreground/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Country</th>
                  <th className="px-4 py-3 text-left font-medium">Terminal Count</th>
                  <th className="px-4 py-3 text-left font-medium">Fetched At</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cacheEntries.map((entry) => (
                  <tr key={`${entry.provider}-${entry.country}`} className="border-b border-surface-border/50 hover:bg-foreground/[0.02]">
                    <td className="px-4 py-3 font-medium">{entry.provider}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground/70">{entry.country}</td>
                    <td className="px-4 py-3 text-foreground/70">{entry.terminalCount}</td>
                    <td className="px-4 py-3 text-foreground/70 text-xs">{formatDate(entry.fetchedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <TerminalsRefreshButton
                          provider={entry.provider}
                          country={entry.country}
                          onSuccess={(updatedEntry) => handleRefreshSuccess(updatedEntry)}
                          onError={(error) => {
                            alert(`Failed to refresh: ${error}`);
                          }}
                        />
                        <button
                          onClick={() => handleDeleteClick(entry)}
                          title="Delete cache"
                          aria-label="Delete cache"
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-red-500/35 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-border bg-background p-4 shadow-2xl">
            <h3 className="text-base font-semibold">Delete Terminal Cache</h3>
            <p className="mt-2 text-sm text-foreground/75">
              Delete cached terminals for <span className="font-medium">{deleteConfirm.provider}</span> in{" "}
              <span className="font-medium">{deleteConfirm.country}</span>? This cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteLoading}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-foreground/[0.05] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="rounded-lg border border-red-500/35 bg-red-500/12 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-500/18 disabled:opacity-50 dark:text-red-300"
              >
                {deleteLoading ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
