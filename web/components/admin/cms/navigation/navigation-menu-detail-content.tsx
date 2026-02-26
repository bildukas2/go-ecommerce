"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, Edit, ExternalLink, Plus, Trash2, Languages, Copy } from "lucide-react";
import {
  AdminCategory,
  AdminNavigationItem,
  AdminNavigationMenu,
  AdminPage,
  createAdminNavigationMenuItem,
  deleteAdminNavigationItem,
  reorderAdminNavigationMenuItems,
  updateAdminNavigationItem,
} from "@/lib/api";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "lt", label: "Lithuanian" },
];

type Props = {
  menu: AdminNavigationMenu;
  initialItems: AdminNavigationItem[];
  pages: AdminPage[];
  categories: AdminCategory[];
};

type ItemFormState = {
  id?: string;
  label: string;
  label_i18n: Record<string, string>;
  type: AdminNavigationItem["type"];
  page_id: string;
  category_id: string;
  url: string;
  open_in_new_tab: boolean;
  sort_order: number;
  is_active: boolean;
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}

function orderedItems(items: AdminNavigationItem[]): AdminNavigationItem[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export function NavigationMenuDetailContent({ menu, initialItems, pages, categories }: Props) {
  const [items, setItems] = useState<AdminNavigationItem[]>(orderedItems(initialItems));
  const [editing, setEditing] = useState<ItemFormState | null>(null);
  const [currentLang, setCurrentLang] = useState("en");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingID, setDeletingID] = useState<string | null>(null);

  const pageByID = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const categoryByID = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  function openCreateModal() {
    setEditing({
      label: "",
      label_i18n: { en: "", lt: "" },
      type: "page",
      page_id: pages[0]?.id ?? "",
      category_id: categories[0]?.id ?? "",
      url: "",
      open_in_new_tab: false,
      sort_order: items.length,
      is_active: true,
    });
    setCurrentLang("en");
    setError(null);
  }

  function openEditModal(item: AdminNavigationItem) {
    setEditing({
      id: item.id,
      label: item.label,
      label_i18n: item.label_i18n || { en: item.label, lt: "" },
      type: item.type,
      page_id: item.page_id ?? "",
      category_id: item.category_id ?? "",
      url: item.url ?? "",
      open_in_new_tab: item.open_in_new_tab,
      sort_order: item.sort_order,
      is_active: item.is_active,
    });
    setCurrentLang("en");
    setError(null);
  }

  function closeModal() {
    if (saving) return;
    setEditing(null);
  }

  async function onSaveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        label: (editing.label_i18n.en || editing.label || "").trim(),
        label_i18n: editing.label_i18n,
        type: editing.type,
        page_id: editing.type === "page" ? editing.page_id || null : null,
        category_id: editing.type === "category" ? editing.category_id || null : null,
        url: editing.type === "url" ? editing.url.trim() || null : null,
        open_in_new_tab: editing.open_in_new_tab,
        sort_order: editing.sort_order,
        is_active: editing.is_active,
      };

      if (editing.id) {
        const updated = await updateAdminNavigationItem(editing.id, payload);
        setItems((prev) => orderedItems(prev.map((item) => (item.id === updated.id ? updated : item))));
      } else {
        const created = await createAdminNavigationMenuItem(menu.id, payload);
        setItems((prev) => orderedItems([...prev, created]));
      }
      setEditing(null);
    } catch (saveError) {
      setError(toErrorMessage(saveError, "Failed to save navigation item"));
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteItem(itemID: string) {
    if (deletingID) return;
    if (!confirm("Delete this navigation item?")) return;
    setDeletingID(itemID);
    setError(null);
    try {
      await deleteAdminNavigationItem(itemID);
      setItems((prev) => orderedItems(prev.filter((item) => item.id !== itemID)));
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, "Failed to delete navigation item"));
    } finally {
      setDeletingID(null);
    }
  }

  async function onMoveItem(currentIndex: number, direction: -1 | 1) {
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const moved = next[currentIndex];
    next[currentIndex] = next[targetIndex];
    next[targetIndex] = moved;

    const withOrder = next.map((item, index) => ({ ...item, sort_order: index }));
    setItems(withOrder);
    try {
      await reorderAdminNavigationMenuItems(menu.id, withOrder.map((item) => item.id));
    } catch (reorderError) {
      setError(toErrorMessage(reorderError, "Failed to reorder items"));
      setItems(orderedItems(initialItems));
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/cms/navigation/menus"
            className="mb-2 inline-flex items-center gap-2 text-sm text-foreground/70 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back to Menus
          </Link>
          <h1 className="text-2xl font-bold">{menu.name}</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Code: <code className="rounded bg-foreground/5 px-2 py-0.5">{menu.code}</code>
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Item
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="glass overflow-x-auto rounded-2xl border border-surface-border shadow-[0_14px_30px_rgba(2,6,23,0.08)]">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
            <tr>
              <th className="w-28 px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground/50">
                  No items in this menu yet.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const page = item.page_id ? pageByID.get(item.page_id) : null;
                const category = item.category_id ? categoryByID.get(item.category_id) : null;
                return (
                  <tr key={item.id} className="transition-colors hover:bg-foreground/[0.01]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onMoveItem(index, -1)}
                          disabled={index === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-surface-border text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-40"
                          title="Move up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveItem(index, 1)}
                          disabled={index === items.length - 1}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-surface-border text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-40"
                          title="Move down"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <span className="ml-1 text-xs text-foreground/60">{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium">{item.label}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-xs uppercase">{item.type}</span>
                    </td>
                    <td className="px-4 py-4">
                      {item.type === "page" && page && (
                        <Link
                          href={`/page/${page.slug.replace(/^\/+/, "")}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          {page.title}
                          <ExternalLink size={12} />
                        </Link>
                      )}
                      {item.type === "category" && category && (
                        <Link
                          href={`/products?category=${encodeURIComponent(category.slug)}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          {category.name}
                          <ExternalLink size={12} />
                        </Link>
                      )}
                      {item.type === "url" && item.url && (
                        <Link href={item.url} target="_blank" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                          {item.url}
                          <ExternalLink size={12} />
                        </Link>
                      )}
                      {((item.type === "page" && !page) || (item.type === "category" && !category) || (item.type === "url" && !item.url)) && (
                        <span className="text-foreground/50">Target unavailable</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${item.is_active ? "bg-emerald-500/15 text-emerald-600" : "bg-foreground/8 text-foreground/60"}`}
                      >
                        {item.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
                          title="Edit item"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          disabled={deletingID === item.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/70 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-60"
                          title="Delete item"
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/40 backdrop-blur-sm"
            onClick={closeModal}
            aria-label="Close modal"
          />
          <div className="glass relative w-full max-w-xl rounded-2xl border border-surface-border p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing.id ? "Edit Navigation Item" : "Add Navigation Item"}</h3>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-surface-border bg-background/50 p-0.5">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setCurrentLang(lang.code)}
                      className={`px-2 py-1 text-xs font-medium transition-colors rounded-md ${
                        currentLang === lang.code
                          ? "bg-blue-600 text-white"
                          : "text-foreground/60 hover:text-foreground"
                      }`}
                    >
                      {lang.code.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(prev => prev ? { ...prev, label_i18n: { ...prev.label_i18n, lt: prev.label_i18n.en } } : null)}
                  className="flex h-7 items-center gap-1 rounded-lg border border-surface-border bg-background/50 px-2 text-[10px] font-medium text-foreground/70 transition-colors hover:bg-background hover:text-foreground"
                  title="Copy English label to Lithuanian"
                >
                  <Copy size={10} />
                  EN→LT
                </button>
              </div>
            </div>
            <form onSubmit={onSaveItem} className="mt-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/70">
                  Label ({currentLang.toUpperCase()})
                </label>
                <input
                  type="text"
                  value={editing.label_i18n[currentLang] || ""}
                  onChange={(event) => setEditing((prev) => (prev ? { ...prev, label_i18n: { ...prev.label_i18n, [currentLang]: event.target.value } } : prev))}
                  required
                  className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/70">Type</label>
                  <select
                    value={editing.type}
                    onChange={(event) =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              type: event.target.value as AdminNavigationItem["type"],
                            }
                          : prev,
                      )
                    }
                    className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                  >
                    <option value="page">Page</option>
                    <option value="category">Category</option>
                    <option value="url">URL</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/70">Sort Order</label>
                  <input
                    type="number"
                    value={editing.sort_order}
                    onChange={(event) =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              sort_order: Number.isNaN(Number(event.target.value)) ? 0 : Number(event.target.value),
                            }
                          : prev,
                      )
                    }
                    className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              {editing.type === "page" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/70">Page</label>
                  <select
                    value={editing.page_id}
                    onChange={(event) => setEditing((prev) => (prev ? { ...prev, page_id: event.target.value } : prev))}
                    required
                    className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                  >
                    <option value="" disabled>
                      Select page
                    </option>
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title} ({page.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editing.type === "category" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/70">Category</label>
                  <select
                    value={editing.category_id}
                    onChange={(event) =>
                      setEditing((prev) => (prev ? { ...prev, category_id: event.target.value } : prev))
                    }
                    required
                    className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                  >
                    <option value="" disabled>
                      Select category
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editing.type === "url" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/70">URL</label>
                  <input
                    type="text"
                    value={editing.url}
                    onChange={(event) => setEditing((prev) => (prev ? { ...prev, url: event.target.value } : prev))}
                    required
                    className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                    placeholder="https://example.com or /custom-path"
                  />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.is_active}
                    onChange={(event) =>
                      setEditing((prev) => (prev ? { ...prev, is_active: event.target.checked } : prev))
                    }
                  />
                  Active
                </label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.open_in_new_tab}
                    onChange={(event) =>
                      setEditing((prev) => (prev ? { ...prev, open_in_new_tab: event.target.checked } : prev))
                    }
                  />
                  Open in new tab
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Saving..." : editing.id ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
