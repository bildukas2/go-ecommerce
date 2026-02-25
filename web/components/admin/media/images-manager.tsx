"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Trash2, X, AlertTriangle, Search, ImageIcon, Loader2, CheckSquare, Square, ExternalLink } from "lucide-react";
import { uploadAdminMedia, deleteAdminMedia, type AdminMediaAsset } from "@/lib/api";
import { createPortal } from "react-dom";

type Props = {
  initialItems: AdminMediaAsset[];
  initialTotal: number;
  pageSize: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function DeletePopover({
  asset,
  onConfirm,
  onCancel,
  buttonRef,
}: {
  asset: AdminMediaAsset;
  onConfirm: () => void;
  onCancel: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const rect = buttonRef.current?.getBoundingClientRect();
  if (!rect) return null;
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUpward = spaceBelow < 170;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: rect.right - 256,
        ...(openUpward ? { bottom: window.innerHeight - rect.top } : { top: rect.bottom + 6 }),
        zIndex: 9999,
      }}
      className="w-64 rounded-xl border border-surface-border bg-background shadow-xl"
    >
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10">
            <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Delete image?</p>
            <p className="mt-0.5 truncate text-xs text-foreground/60" title={asset.alt || asset.url}>
              {asset.alt || asset.storage_path.split("/").pop()}
            </p>
            <p className="mt-1 text-xs text-foreground/50">File will be permanently removed.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-surface-border bg-foreground/[0.03] px-3 py-1.5 text-xs font-medium hover:bg-foreground/[0.07]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ImagesManager({ initialItems, initialTotal: _initialTotal, pageSize: _pageSize }: Props) {
  const [items, setItems] = useState<AdminMediaAsset[]>(initialItems);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [deletingID, setDeletingID] = useState<string | null>(null);
  const [confirmAsset, setConfirmAsset] = useState<AdminMediaAsset | null>(null);
  const [selectedIDs, setSelectedIDs] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const deleteButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const bulkButtonRef = useRef<HTMLButtonElement>(null);

  const filtered = search
    ? items.filter(
        (a) =>
          a.alt.toLowerCase().includes(search.toLowerCase()) ||
          a.url.toLowerCase().includes(search.toLowerCase()) ||
          a.storage_path.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  async function handleUploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    setError(null);
    const done: string[] = [];
    for (const file of list) {
      setUploadProgress([...done, `Uploading ${file.name}...`]);
      try {
        const asset = await uploadAdminMedia(file, file.name.replace(/\.[^.]+$/, ""));
        setItems((prev) => [asset, ...prev]);
        done.push(file.name);
      } catch (e) {
        setError(`Failed to upload ${file.name}: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    }
    setUploadProgress([]);
    setUploading(false);
  }

  async function handleDelete(asset: AdminMediaAsset) {
    setDeletingID(asset.id);
    setConfirmAsset(null);
    setError(null);
    try {
      await deleteAdminMedia(asset.id);
      setItems((prev) => prev.filter((a) => a.id !== asset.id));
      setSelectedIDs((prev) => { const next = new Set(prev); next.delete(asset.id); return next; });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingID(null);
    }
  }

  async function handleBulkDelete() {
    setBulkConfirm(false);
    setError(null);
    const ids = Array.from(selectedIDs);
    for (const id of ids) {
      try {
        await deleteAdminMedia(id);
        setItems((prev) => prev.filter((a) => a.id !== id));
      } catch {
        // continue
      }
    }
    setSelectedIDs(new Set());
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIDs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIDs.size === filtered.length && filtered.length > 0) {
      setSelectedIDs(new Set());
    } else {
      setSelectedIDs(new Set(filtered.map((a) => a.id)));
    }
  }, [selectedIDs, filtered]);

  const allSelected = filtered.length > 0 && selectedIDs.size === filtered.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Upload zone */}
      <div
        className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-surface-border bg-foreground/[0.01] py-8 transition-colors hover:border-blue-500/40 hover:bg-blue-500/[0.02]"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleUploadFiles(e.dataTransfer.files); }}
      >
        {uploading ? (
          <>
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <p className="text-sm text-foreground/60">{uploadProgress[uploadProgress.length - 1] ?? "Uploading..."}</p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10">
              <Upload size={22} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Drop images here or click to upload</p>
              <p className="mt-0.5 text-xs text-foreground/50">JPEG, PNG, WebP, AVIF, GIF — max 5 MB each</p>
            </div>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) handleUploadFiles(e.target.files); e.target.value = ""; }} />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle size={15} />
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            type="search"
            placeholder="Search by name or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500/50"
          />
        </div>
        <span className="text-sm text-foreground/50">{filtered.length} image{filtered.length !== 1 ? "s" : ""}</span>
        {selectedIDs.size > 0 && (
          <button
            ref={bulkButtonRef}
            type="button"
            onClick={() => setBulkConfirm(true)}
            className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
          >
            <Trash2 size={14} />
            Delete {selectedIDs.size} selected
          </button>
        )}
        {bulkConfirm && bulkButtonRef.current && (
          <DeletePopover
            asset={{ id: "", url: "", storage_path: "", mime_type: "", size_bytes: 0, alt: `${selectedIDs.size} images`, source_type: "", created_at: "" }}
            onConfirm={handleBulkDelete}
            onCancel={() => setBulkConfirm(false)}
            buttonRef={bulkButtonRef}
          />
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surface-border py-16 text-center">
          <ImageIcon size={32} className="text-foreground/20" />
          <p className="text-sm text-foreground/50">{search ? "No images match your search." : "No images uploaded yet."}</p>
        </div>
      ) : (
        <>
          {/* Select-all row */}
          <div className="flex items-center gap-2 px-1">
            <button type="button" onClick={toggleAll} className="flex items-center gap-2 text-xs text-foreground/60 hover:text-foreground">
              {allSelected ? <CheckSquare size={14} className="text-blue-500" /> : <Square size={14} />}
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((asset) => {
              const isSelected = selectedIDs.has(asset.id);
              const isDeleting = deletingID === asset.id;
              const isConfirming = confirmAsset?.id === asset.id;
              const filename = asset.storage_path.split("/").pop() ?? "";

              return (
                <div
                  key={asset.id}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-colors ${isSelected ? "border-blue-500/50 bg-blue-500/[0.04]" : "border-surface-border bg-background"}`}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(asset.id)}
                    className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-lg border border-surface-border bg-background/80 backdrop-blur-sm transition-opacity group-hover:opacity-100 opacity-0 data-[selected=true]:opacity-100"
                    data-selected={isSelected}
                  >
                    {isSelected ? <CheckSquare size={13} className="text-blue-500" /> : <Square size={13} className="text-foreground/50" />}
                  </button>

                  {/* Image */}
                  <div className="image-default-bg aspect-square w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.alt || filename}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {isDeleting && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                        <Loader2 size={20} className="animate-spin text-red-500" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-1 p-2">
                    <p className="truncate text-xs font-medium" title={asset.alt || filename}>
                      {asset.alt || filename}
                    </p>
                    <p className="text-[10px] text-foreground/45">{formatBytes(asset.size_bytes)} · {formatDate(asset.created_at)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-t border-surface-border px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg text-xs text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground"
                    >
                      <ExternalLink size={11} />
                      View
                    </a>
                    <button
                      ref={(el) => { if (el) deleteButtonRefs.current.set(asset.id, el); else deleteButtonRefs.current.delete(asset.id); }}
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setConfirmAsset(isConfirming ? null : asset)}
                      className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"
                    >
                      <Trash2 size={11} />
                      Delete
                    </button>
                  </div>

                  {isConfirming && deleteButtonRefs.current.get(asset.id) && (
                    <DeletePopover
                      asset={asset}
                      onConfirm={() => handleDelete(asset)}
                      onCancel={() => setConfirmAsset(null)}
                      buttonRef={{ current: deleteButtonRefs.current.get(asset.id) ?? null }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
