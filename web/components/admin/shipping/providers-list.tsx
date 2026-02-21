"use client";

import { useState } from "react";
import { Trash2, Edit2, Plus } from "lucide-react";
import type { ShippingProvider } from "@/lib/api";
import { deleteShippingProvider } from "@/lib/api";
import { ProviderForm } from "./provider-form";

type Props = {
  initialProviders: ShippingProvider[];
  onProviderUpdated?: () => void;
};

export function ProvidersList({ initialProviders, onProviderUpdated }: Props) {
  const [providers, setProviders] = useState(initialProviders);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ShippingProvider | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ key: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleAddProvider = () => {
    setSelectedProvider(null);
    setIsFormOpen(true);
  };

  const handleEditProvider = (provider: ShippingProvider) => {
    setSelectedProvider(provider);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedProvider(null);
  };

  const handleFormSuccess = (newProviders: ShippingProvider[]) => {
    setProviders(newProviders);
    handleFormClose();
    onProviderUpdated?.();
  };

  const handleDeleteClick = (key: string, name: string) => {
    setDeleteConfirm({ key, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    setDeleteLoading(true);
    try {
      await deleteShippingProvider(deleteConfirm.key);
      setProviders(providers.filter((p) => p.key !== deleteConfirm.key));
      setDeleteConfirm(null);
      onProviderUpdated?.();
    } catch (error) {
      alert(`Failed to delete provider: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
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
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Shipping Providers</h3>
          <button
            onClick={handleAddProvider}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
          >
            <Plus size={16} />
            Add Provider
          </button>
        </div>

        {providers.length === 0 ? (
          <div className="rounded-xl border border-surface-border bg-foreground/[0.02] p-6 text-center text-foreground/70">
            <p>No providers configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border bg-foreground/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Key</th>
                  <th className="px-4 py-3 text-left font-medium">Mode</th>
                  <th className="px-4 py-3 text-left font-medium">Enabled</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.id} className="border-b border-surface-border/50 hover:bg-foreground/[0.02]">
                    <td className="px-4 py-3 font-medium">{provider.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground/70">{provider.key}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-block rounded-full px-2 py-1 text-xs font-medium",
                          provider.mode === "live"
                            ? "border border-orange-500/35 bg-orange-500/12 text-orange-700 dark:text-orange-300"
                            : "border border-blue-500/35 bg-blue-500/12 text-blue-700 dark:text-blue-300",
                        ].join(" ")}
                      >
                        {provider.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-block rounded-full px-2 py-1 text-xs font-medium",
                          provider.enabled
                            ? "border border-green-500/35 bg-green-500/12 text-green-700 dark:text-green-300"
                            : "border border-gray-500/35 bg-gray-500/12 text-gray-700 dark:text-gray-300",
                        ].join(" ")}
                      >
                        {provider.enabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{formatDate(provider.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditProvider(provider)}
                          title="Edit provider"
                          aria-label="Edit provider"
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-blue-500/35 bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 dark:text-blue-300"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(provider.key, provider.name)}
                          title="Delete provider"
                          aria-label="Delete provider"
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

      {isFormOpen && (
        <ProviderForm
          provider={selectedProvider}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          currentProviders={providers}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-border bg-background p-4 shadow-2xl">
            <h3 className="text-base font-semibold">Delete Provider</h3>
            <p className="mt-2 text-sm text-foreground/75">
              Delete <span className="font-medium">{deleteConfirm.name}</span>? This cannot be undone.
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
