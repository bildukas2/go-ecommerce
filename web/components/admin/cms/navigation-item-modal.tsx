"use client";

import { X, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { AdminNavigationItem, AdminPage } from "@/lib/api";

type Props = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item?: AdminNavigationItem | null;
  pages: AdminPage[];
  onSave: (data: Partial<AdminNavigationItem>) => Promise<void>;
};

export function NavigationItemModal({ 
  isOpen, 
  onOpenChange, 
  item, 
  pages,
  onSave 
}: Props) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"page" | "url">("page");
  const [pageId, setPageId] = useState<string>("");
  const [url, setUrl] = useState("");
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setLabel(item.label);
      setType(item.type);
      setPageId(item.page_id || "");
      setUrl(item.url || "");
      setOpenInNewTab(item.open_in_new_tab);
      setIsActive(item.is_active);
      setSortOrder(item.sort_order);
    } else {
      setLabel("");
      setType("page");
      setPageId("");
      setUrl("");
      setOpenInNewTab(false);
      setIsActive(true);
      setSortOrder(0);
    }
    setError(null);
  }, [item, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError("Label is required");
      return;
    }

    if (type === "page" && !pageId) {
      setError("Please select a page");
      return;
    }

    if (type === "url" && !url.trim()) {
      setError("URL is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave({
        label,
        type,
        page_id: type === "page" ? pageId : null,
        url: type === "url" ? url : null,
        open_in_new_tab: openInNewTab,
        is_active: isActive,
        sort_order: sortOrder
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "An error occurred while saving");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-background/40 backdrop-blur-sm transition-opacity" 
        onClick={() => !loading && onOpenChange(false)} 
      />
      
      <div className="glass relative w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-surface-border p-6">
          <h2 className="text-xl font-bold">
            {item ? "Edit Navigation Item" : "Add Navigation Item"}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex flex-col gap-5">
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={18} />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground/70">Label</label>
              <input
                type="text"
                placeholder="e.g. About Us"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground/70">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "page" | "url")}
                  className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                >
                  <option value="page">Page</option>
                  <option value="url">URL</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground/70">Sort Order</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            {type === "page" ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground/70">Select Page</label>
                <select
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                >
                  <option value="" disabled>Choose a page...</option>
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title} ({page.slug})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground/70">URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                />
              </div>
            )}

            <div className="flex flex-col gap-4 py-2 border-t border-surface-border pt-4">
              <label className="flex cursor-pointer items-center gap-3">
                <div className="relative h-5 w-5">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-surface-border bg-background/50 transition-all checked:bg-blue-600 checked:border-blue-600"
                  />
                  <svg className="absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Active</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <div className="relative h-5 w-5">
                  <input
                    type="checkbox"
                    checked={openInNewTab}
                    onChange={(e) => setOpenInNewTab(e.target.checked)}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-surface-border bg-background/50 transition-all checked:bg-blue-600 checked:border-blue-600"
                  />
                  <svg className="absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Open in new tab</span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 border-t border-surface-border pt-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {item ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
