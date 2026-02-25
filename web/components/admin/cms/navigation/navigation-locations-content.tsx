"use client";

import { useState } from "react";
import { AdminNavigationLocation, AdminNavigationMenu, assignAdminNavigationLocation } from "@/lib/api";

type Props = {
  initialLocations: AdminNavigationLocation[];
  menus: AdminNavigationMenu[];
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}

export function NavigationLocationsContent({ initialLocations, menus }: Props) {
  const [locations, setLocations] = useState<AdminNavigationLocation[]>(initialLocations);
  const [error, setError] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  async function onAssign(code: string, menuID: string) {
    if (savingCode) return;
    setSavingCode(code);
    setError(null);
    try {
      await assignAdminNavigationLocation(code, menuID || null);
      const selectedMenu = menus.find((menu) => menu.id === menuID) ?? null;
      setLocations((prev) =>
        prev.map((location) =>
          location.code === code
            ? {
                ...location,
                menu_id: selectedMenu?.id ?? null,
                menu_code: selectedMenu?.code ?? null,
                menu_name: selectedMenu?.name ?? null,
                assignment_updated_at: new Date().toISOString(),
              }
            : location,
        ),
      );
    } catch (assignError) {
      setError(toErrorMessage(assignError, "Failed to assign location"));
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="glass rounded-2xl border border-surface-border p-4 shadow-[0_14px_30px_rgba(2,6,23,0.08)]">
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
            <tr>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Assigned Menu</th>
              <th className="px-4 py-3 font-medium">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {locations.map((location) => (
              <tr key={location.code} className="transition-colors hover:bg-foreground/[0.01]">
                <td className="px-4 py-4">
                  <div className="font-medium">{location.name}</div>
                  {location.description && <div className="mt-1 text-xs text-foreground/50">{location.description}</div>}
                </td>
                <td className="px-4 py-4">
                  <code className="rounded bg-foreground/5 px-2 py-1 text-xs">{location.code}</code>
                </td>
                <td className="px-4 py-4">
                  <select
                    value={location.menu_id ?? ""}
                    onChange={(event) => onAssign(location.code, event.target.value)}
                    disabled={savingCode === location.code}
                    className="min-w-[220px] rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50 disabled:opacity-60"
                  >
                    <option value="">Unassigned</option>
                    {menus.map((menu) => (
                      <option key={menu.id} value={menu.id}>
                        {menu.name} ({menu.code})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-4 text-foreground/70">
                  {location.assignment_updated_at
                    ? new Date(location.assignment_updated_at).toLocaleString()
                    : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
