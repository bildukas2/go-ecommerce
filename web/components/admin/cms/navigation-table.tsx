"use client";

import { Edit, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AdminNavigationItem, AdminPage } from "@/lib/api";
import { useState } from "react";

type Props = {
  items: AdminNavigationItem[];
  pages: AdminPage[];
  onEdit: (item: AdminNavigationItem) => void;
  onDelete: (id: string) => Promise<void>;
  onReorder: (id: string, newOrder: number) => Promise<void>;
};

export function NavigationTable({ 
  items, 
  pages, 
  onEdit, 
  onDelete, 
  onReorder 
}: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const getPageTitle = (pageId?: string | null) => {
    if (!pageId) return "-";
    const page = pages.find((p) => p.id === pageId);
    return page ? page.title : "Unknown Page";
  };

  const getPageSlug = (pageId?: string | null) => {
    if (!pageId) return null;
    const page = pages.find((p) => p.id === pageId);
    return page ? page.slug : null;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this navigation item?")) {
      return;
    }
    setLoadingId(id);
    try {
      await onDelete(id);
    } finally {
      setLoadingId(null);
    }
  };

  const handleReorderChange = async (id: string, value: string) => {
    const newOrder = parseInt(value, 10);
    if (!isNaN(newOrder)) {
      await onReorder(id, newOrder);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
          <tr>
            <th className="w-20 px-4 py-3 font-medium">Sort</th>
            <th className="px-4 py-3 font-medium">Label</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Target</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-foreground/50">
                No navigation items found
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-foreground/[0.01]">
                <td className="px-4 py-4">
                  <input
                    type="number"
                    className="w-16 rounded-lg border border-surface-border bg-background/50 px-2 py-1 text-center text-sm outline-none focus:border-blue-500/50"
                    defaultValue={item.sort_order.toString()}
                    onBlur={(e) => {
                      if (parseInt(e.target.value) !== item.sort_order) {
                        handleReorderChange(item.id, e.target.value);
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col">
                    <p className="font-medium">{item.label}</p>
                    {item.open_in_new_tab && (
                      <p className="text-xs text-foreground/40 text-[10px] uppercase font-semibold">New Tab</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    item.type === "page" ? "bg-blue-500/15 text-blue-600 dark:text-blue-300" : "bg-purple-500/15 text-purple-600 dark:text-purple-300"
                  }`}>
                    {item.type}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {item.type === "page" ? (
                    <div className="flex flex-col">
                      <span className="font-medium">{getPageTitle(item.page_id)}</span>
                      {getPageSlug(item.page_id) && (
                        <Link 
                          href={`/page${getPageSlug(item.page_id)!.startsWith('/') ? '' : '/'}${getPageSlug(item.page_id)}`} 
                          target="_blank"
                          className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                        >
                          {getPageSlug(item.page_id)}
                          <ExternalLink size={10} />
                        </Link>
                      )}
                    </div>
                  ) : (
                    <Link 
                      href={item.url || "#"} 
                      target="_blank"
                      className="flex items-center gap-1 text-blue-500 hover:underline"
                    >
                      {item.url}
                      <ExternalLink size={12} />
                    </Link>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.is_active ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-foreground/5 text-foreground/40"
                  }`}>
                    {item.is_active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
                      title="Edit item"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={loadingId === item.id}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/50 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                      title="Delete item"
                    >
                      {loadingId === item.id ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
