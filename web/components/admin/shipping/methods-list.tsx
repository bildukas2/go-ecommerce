"use client";

import { useState } from "react";
import { Trash2, Edit2, Plus } from "lucide-react";
import type { ShippingMethod, ShippingZone, ShippingProvider } from "@/lib/api";
import { deleteShippingMethod } from "@/lib/api";
import { MethodForm } from "./method-form";

type Props = {
  initialMethods: ShippingMethod[];
  initialZones: ShippingZone[];
  initialProviders: ShippingProvider[];
  onMethodUpdated?: () => void;
};

export function MethodsList({
  initialMethods,
  initialZones,
  initialProviders,
  onMethodUpdated,
}: Props) {
  const [methods, setMethods] = useState(initialMethods);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<ShippingMethod | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleAddMethod = () => {
    setSelectedMethod(null);
    setIsFormOpen(true);
  };

  const handleEditMethod = (method: ShippingMethod) => {
    setSelectedMethod(method);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedMethod(null);
  };

  const handleFormSuccess = (newMethods: ShippingMethod[]) => {
    setMethods(newMethods);
    handleFormClose();
    onMethodUpdated?.();
  };

  const handleDeleteClick = (id: string, title: string) => {
    setDeleteConfirm({ id, title });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    setDeleteLoading(true);
    try {
      await deleteShippingMethod(deleteConfirm.id);
      setMethods(methods.filter((m) => m.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      onMethodUpdated?.();
    } catch (error) {
      alert(`Failed to delete method: ${error instanceof Error ? error.message : "Unknown error"}`);
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

  const getZoneName = (zoneId: string) => {
    const zone = initialZones.find((z) => z.id === zoneId);
    return zone?.name || "(unknown zone)";
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Shipping Methods</h3>
          <button
            onClick={handleAddMethod}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
          >
            <Plus size={16} />
            Add Method
          </button>
        </div>

        {methods.length === 0 ? (
          <div className="rounded-xl border border-surface-border bg-foreground/[0.02] p-6 text-center text-foreground/70">
            <p>No methods configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border bg-foreground/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Zone</th>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Service Code</th>
                  <th className="px-4 py-3 text-left font-medium">Pricing Mode</th>
                  <th className="px-4 py-3 text-left font-medium">Sort Order</th>
                  <th className="px-4 py-3 text-left font-medium">Enabled</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => (
                  <tr key={method.id} className="border-b border-surface-border/50 hover:bg-foreground/[0.02]">
                    <td className="px-4 py-3 font-medium">{method.title}</td>
                    <td className="px-4 py-3 text-foreground/70">{getZoneName(method.zone_id)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground/70">{method.provider_key}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground/70">{method.service_code}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-block rounded-full px-2 py-1 text-xs font-medium",
                          method.pricing_mode === "fixed"
                            ? "border border-blue-500/35 bg-blue-500/12 text-blue-700 dark:text-blue-300"
                            : method.pricing_mode === "table"
                              ? "border border-purple-500/35 bg-purple-500/12 text-purple-700 dark:text-purple-300"
                              : "border border-green-500/35 bg-green-500/12 text-green-700 dark:text-green-300",
                        ].join(" ")}
                      >
                        {method.pricing_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{method.sort_order}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-block rounded-full px-2 py-1 text-xs font-medium",
                          method.enabled
                            ? "border border-green-500/35 bg-green-500/12 text-green-700 dark:text-green-300"
                            : "border border-gray-500/35 bg-gray-500/12 text-gray-700 dark:text-gray-300",
                        ].join(" ")}
                      >
                        {method.enabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{formatDate(method.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditMethod(method)}
                          title="Edit method"
                          aria-label="Edit method"
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-blue-500/35 bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 dark:text-blue-300"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(method.id, method.title)}
                          title="Delete method"
                          aria-label="Delete method"
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
        <MethodForm
          method={selectedMethod}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          currentMethods={methods}
          zones={initialZones}
          providers={initialProviders}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-border bg-background p-4 shadow-2xl">
            <h3 className="text-base font-semibold">Delete Method</h3>
            <p className="mt-2 text-sm text-foreground/75">
              Delete <span className="font-medium">{deleteConfirm.title}</span>? This cannot be undone.
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
