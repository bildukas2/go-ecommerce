"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus } from "lucide-react";
import type { PaymentMethod, ShippingMethod } from "@/lib/api";
import { deletePaymentMethod, getShippingMethods } from "@/lib/api";
import { MethodTypeSelector } from "./method-type-selector";

type Props = {
  initialMethods: PaymentMethod[];
  onMethodUpdated?: () => void;
};

export function PaymentMethodsList({ initialMethods, onMethodUpdated }: Props) {
  const [methods, setMethods] = useState(initialMethods);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    getShippingMethods()
      .then(setShippingMethods)
      .catch((err) => console.error("Failed to fetch shipping methods:", err));
  }, []);

  const handleAddMethod = () => {
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
  };

  const handleFormSuccess = (newMethods: PaymentMethod[]) => {
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
      await deletePaymentMethod(deleteConfirm.id);
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

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case "manual":
        return { label: "Manual", classes: "border border-blue-500/35 bg-blue-500/12 text-blue-700 dark:text-blue-300" };
      case "provider":
        return { label: "Provider", classes: "border border-purple-500/35 bg-purple-500/12 text-purple-700 dark:text-purple-300" };
      default:
        return { label: type, classes: "border border-gray-500/35 bg-gray-500/12 text-gray-700 dark:text-gray-300" };
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Payment Methods</h3>
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
            <p>No payment methods configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border bg-foreground/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Key</th>
                  <th className="px-4 py-3 text-left font-medium">Enabled</th>
                  <th className="px-4 py-3 text-left font-medium">Sort Order</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => {
                  const paymentType = getPaymentTypeLabel(method.payment_type);
                  return (
                    <tr key={method.id} className="border-b border-surface-border/50 hover:bg-foreground/[0.02]">
                      <td className="px-4 py-3 font-medium">{method.title}</td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-block rounded-full px-2 py-1 text-xs font-medium",
                            paymentType.classes,
                          ].join(" ")}
                        >
                          {paymentType.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground/70">{method.key}</td>
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
                      <td className="px-4 py-3 text-foreground/70">{method.sort_order}</td>
                      <td className="px-4 py-3 text-foreground/70">{formatDate(method.updated_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteClick(method.id, method.title)}
                          title="Delete method"
                          aria-label="Delete method"
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-red-500/35 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <MethodTypeSelector
          methods={methods}
          shippingMethods={shippingMethods}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-border bg-background p-4 shadow-2xl">
            <h3 className="text-base font-semibold">Delete Payment Method</h3>
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
