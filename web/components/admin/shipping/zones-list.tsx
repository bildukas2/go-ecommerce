"use client";

import { useState } from "react";
import { Trash2, Edit2, Plus } from "lucide-react";
import type { ShippingZone } from "@/lib/api";
import { deleteShippingZone } from "@/lib/api";
import { ZoneForm } from "./zone-form";

type Props = {
  initialZones: ShippingZone[];
  onZoneUpdated?: () => void;
};

export function ZonesList({ initialZones, onZoneUpdated }: Props) {
  const [zones, setZones] = useState(initialZones);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<ShippingZone | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleAddZone = () => {
    setSelectedZone(null);
    setIsFormOpen(true);
  };

  const handleEditZone = (zone: ShippingZone) => {
    setSelectedZone(zone);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedZone(null);
  };

  const handleFormSuccess = (newZones: ShippingZone[]) => {
    setZones(newZones);
    handleFormClose();
    onZoneUpdated?.();
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    setDeleteLoading(true);
    try {
      await deleteShippingZone(deleteConfirm.id);
      setZones(zones.filter((z) => z.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      onZoneUpdated?.();
    } catch (error) {
      alert(`Failed to delete zone: ${error instanceof Error ? error.message : "Unknown error"}`);
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

  const formatCountries = (countries: string[]) => {
    if (countries.length === 0) return "(none)";
    if (countries.length <= 3) return countries.join(", ");
    return `${countries.slice(0, 3).join(", ")} +${countries.length - 3}`;
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Shipping Zones</h3>
          <button
            onClick={handleAddZone}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
          >
            <Plus size={16} />
            Add Zone
          </button>
        </div>

        {zones.length === 0 ? (
          <div className="rounded-xl border border-surface-border bg-foreground/[0.02] p-6 text-center text-foreground/70">
            <p>No zones configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border bg-foreground/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Countries</th>
                  <th className="px-4 py-3 text-left font-medium">Enabled</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id} className="border-b border-surface-border/50 hover:bg-foreground/[0.02]">
                    <td className="px-4 py-3 font-medium">{zone.name}</td>
                    <td className="px-4 py-3 text-foreground/70">{formatCountries(zone.countries_json)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-block rounded-full px-2 py-1 text-xs font-medium",
                          zone.enabled
                            ? "border border-green-500/35 bg-green-500/12 text-green-700 dark:text-green-300"
                            : "border border-gray-500/35 bg-gray-500/12 text-gray-700 dark:text-gray-300",
                        ].join(" ")}
                      >
                        {zone.enabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{formatDate(zone.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditZone(zone)}
                          title="Edit zone"
                          aria-label="Edit zone"
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-blue-500/35 bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 dark:text-blue-300"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(zone.id, zone.name)}
                          title="Delete zone"
                          aria-label="Delete zone"
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
        <ZoneForm
          zone={selectedZone}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          currentZones={zones}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-border bg-background p-4 shadow-2xl">
            <h3 className="text-base font-semibold">Delete Zone</h3>
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
