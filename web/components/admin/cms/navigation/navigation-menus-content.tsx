"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Edit, Plus, Trash2 } from "lucide-react";
import {
  AdminNavigationLocation,
  AdminNavigationMenu,
  createAdminNavigationMenu,
  deleteAdminNavigationMenu,
  updateAdminNavigationMenu,
} from "@/lib/api";

type Props = {
  initialMenus: AdminNavigationMenu[];
  initialLocations: AdminNavigationLocation[];
  initialItemCounts: Record<string, number>;
};

type MenuFormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}

export function NavigationMenusContent({ initialMenus, initialLocations, initialItemCounts }: Props) {
  const [menus, setMenus] = useState<AdminNavigationMenu[]>(initialMenus);
  const [locations] = useState<AdminNavigationLocation[]>(initialLocations);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>(initialItemCounts);
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState<MenuFormState>({ code: "", name: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteID, setDeleteID] = useState<string | null>(null);

  const assignedByMenuID = useMemo(() => {
    const assigned = new Map<string, string[]>();
    for (const location of locations) {
      if (!location.menu_id) continue;
      const list = assigned.get(location.menu_id) ?? [];
      list.push(location.code);
      assigned.set(location.menu_id, list);
    }
    return assigned;
  }, [locations]);

  function openCreateModal() {
    setFormState({ code: "", name: "", description: "" });
    setError(null);
    setIsOpen(true);
  }

  function openEditModal(menu: AdminNavigationMenu) {
    setFormState({
      id: menu.id,
      code: menu.code,
      name: menu.name,
      description: menu.description ?? "",
    });
    setError(null);
    setIsOpen(true);
  }

  async function onSaveMenu(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      if (formState.id) {
        const updated = await updateAdminNavigationMenu(formState.id, {
          code: formState.code.trim(),
          name: formState.name.trim(),
          description: formState.description.trim() || null,
        });
        setMenus((prev) => prev.map((menu) => (menu.id === updated.id ? updated : menu)));
      } else {
        const created = await createAdminNavigationMenu({
          code: formState.code.trim(),
          name: formState.name.trim(),
          description: formState.description.trim() || null,
        });
        setMenus((prev) => [created, ...prev]);
        setItemCounts((prev) => ({ ...prev, [created.id]: 0 }));
      }
      setIsOpen(false);
    } catch (saveError) {
      setError(toErrorMessage(saveError, "Failed to save menu"));
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteMenu(menuID: string) {
    if (deleteID) return;
    if (!confirm("Delete this menu? Menus assigned to locations cannot be deleted.")) return;
    setDeleteID(menuID);
    setError(null);
    try {
      await deleteAdminNavigationMenu(menuID);
      setMenus((prev) => prev.filter((menu) => menu.id !== menuID));
      setItemCounts((prev) => {
        const next = { ...prev };
        delete next[menuID];
        return next;
      });
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, "Failed to delete menu"));
    } finally {
      setDeleteID(null);
    }
  }

  return (
    <div className="glass rounded-2xl p-4 shadow-[0_14px_30px_rgba(2,6,23,0.08)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Menus</h2>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} />
          Create Menu
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Assigned Locations</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {menus.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">
                  No menus found.
                </td>
              </tr>
            ) : (
              menus.map((menu) => {
                const assigned = assignedByMenuID.get(menu.id) ?? [];
                return (
                  <tr key={menu.id} className="transition-colors hover:bg-foreground/[0.01]">
                    <td className="px-4 py-4">
                      <div className="font-medium">{menu.name}</div>
                      {menu.description && <div className="mt-1 text-xs text-foreground/50">{menu.description}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <code className="rounded bg-foreground/5 px-2 py-1 text-xs">{menu.code}</code>
                    </td>
                    <td className="px-4 py-4">{itemCounts[menu.id] ?? 0}</td>
                    <td className="px-4 py-4">
                      {assigned.length === 0 ? (
                        <span className="text-foreground/50">Unassigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {assigned.map((code) => (
                            <span key={code} className="rounded-full bg-foreground/8 px-2 py-0.5 text-xs">
                              {code}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/cms/navigation/menus/${menu.id}`}
                          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/5"
                        >
                          Manage Items
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(menu)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
                          title="Edit menu"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMenu(menu.id)}
                          disabled={deleteID === menu.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/70 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-60"
                          title="Delete menu"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/40 backdrop-blur-sm"
            onClick={() => !loading && setIsOpen(false)}
            aria-label="Close modal"
          />
          <div className="glass relative w-full max-w-lg rounded-2xl border border-surface-border p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">{formState.id ? "Edit Menu" : "Create Menu"}</h3>
            <form onSubmit={onSaveMenu} className="mt-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/70">Name</label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/70">Code</label>
                <input
                  type="text"
                  value={formState.code}
                  onChange={(event) => setFormState((prev) => ({ ...prev, code: event.target.value }))}
                  required
                  className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/70">Description</label>
                <textarea
                  value={formState.description}
                  onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? "Saving..." : formState.id ? "Save Changes" : "Create Menu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
