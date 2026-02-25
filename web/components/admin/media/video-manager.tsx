"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Trash2, X, AlertTriangle, Search, Video, Loader2, CheckSquare, Square, ExternalLink, Play } from "lucide-react";
import { uploadAdminVideo, deleteAdminMedia, type AdminMediaAsset } from "@/lib/api";
import { createPortal } from "react-dom";

type Props = {
  initialItems: AdminMediaAsset[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function DeletePopover({
  label,
  onConfirm,
  onCancel,
  buttonRef,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const rect = buttonRef.current?.getBoundingClientRect();
  if (!rect) return null;
  const openUpward = window.innerHeight - rect.bottom < 170;
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: Math.max(8, rect.right - 256),
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
            <p className="text-sm font-semibold">Delete video?</p>
            <p className="mt-0.5 truncate text-xs text-foreground/60" title={label}>{label}</p>
            <p className="mt-1 text-xs text-foreground/50">File will be permanently removed.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-surface-border bg-foreground/[0.03] px-3 py-1.5 text-xs font-medium hover:bg-foreground/[0.07]">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function VideoManager({ initialItems }: Props) {
  const [items, setItems] = useState<AdminMediaAsset[]>(initialItems);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState("");
  const [deletingID, setDeletingID] = useState<string | null>(null);
  const [confirmAsset, setConfirmAsset] = useState<AdminMediaAsset | null>(null);
  const [selectedIDs, setSelectedIDs] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const deleteButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const bulkButtonRef = useRef<HTMLButtonElement>(null);

  const ALLOWED_EXTS = [".mp4", ".webm", ".ogv", ".mov"];

  const filtered = search
    ? items.filter(
        (a) =>
          a.alt.toLowerCase().includes(search.toLowerCase()) ||
          basename(a.storage_path).toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  async function handleUploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("video/") || ALLOWED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (!list.length) {
      setError("No supported video files selected. Supported: MP4, WebM, OGV, MOV.");
      return;
    }
    setUploading(true);
    setError(null);
    for (const file of list) {
      setUploadingName(file.name);
      try {
        const asset = await uploadAdminVideo(file, file.name.replace(/\.[^.]+$/, ""));
        setItems((prev) => [asset, ...prev]);
      } catch (e) {
        setError(`Failed to upload ${file.name}: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    }
    setUploadingName("");
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
      if (previewURL === asset.url) setPreviewURL(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingID(null);
    }
  }

  async function handleBulkDelete() {
    setBulkConfirm(false);
    setError(null);
    for (const id of Array.from(selectedIDs)) {
      try {
        await deleteAdminMedia(id);
        setItems((prev) => prev.filter((a) => a.id !== id));
      } catch { /* continue */ }
    }
    setSelectedIDs(new Set());
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIDs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const allSelected = filtered.length > 0 && selectedIDs.size === filtered.length;
  const toggleAll = useCallback(() => {
    setSelectedIDs(allSelected ? new Set() : new Set(filtered.map((a) => a.id)));
  }, [allSelected, filtered]);

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
            <p className="text-sm text-foreground/60">Uploading {uploadingName}…</p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10">
              <Upload size={22} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Drop videos here or click to upload</p>
              <p className="mt-0.5 text-xs text-foreground/50">MP4, WebM, OGV, MOV — max 200 MB each</p>
            </div>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="video/*,.mp4,.webm,.ogv,.mov" multiple className="hidden"
        onChange={(e) => { if (e.target.files) handleUploadFiles(e.target.files); e.target.value = ""; }} />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle size={15} />{error}
          <button type="button" onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input type="search" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500/50" />
        </div>
        <span className="text-sm text-foreground/50">{filtered.length} video{filtered.length !== 1 ? "s" : ""}</span>
        {selectedIDs.size > 0 && (
          <button ref={bulkButtonRef} type="button" onClick={() => setBulkConfirm(true)}
            className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            <Trash2 size={14} />Delete {selectedIDs.size} selected
          </button>
        )}
        {bulkConfirm && bulkButtonRef.current && (
          <DeletePopover label={`${selectedIDs.size} videos`} onConfirm={handleBulkDelete} onCancel={() => setBulkConfirm(false)} buttonRef={bulkButtonRef} />
        )}
      </div>

      {/* Preview player */}
      {previewURL && (
        <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-black">
          <button type="button" onClick={() => setPreviewURL(null)}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
            <X size={16} />
          </button>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={previewURL} controls autoPlay className="max-h-[480px] w-full" />
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surface-border py-16 text-center">
          <Video size={32} className="text-foreground/20" />
          <p className="text-sm text-foreground/50">{search ? "No videos match your search." : "No videos uploaded yet."}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-1">
            <button type="button" onClick={toggleAll} className="flex items-center gap-2 text-xs text-foreground/60 hover:text-foreground">
              {allSelected ? <CheckSquare size={14} className="text-blue-500" /> : <Square size={14} />}
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((asset) => {
              const isSelected = selectedIDs.has(asset.id);
              const isDeleting = deletingID === asset.id;
              const isConfirming = confirmAsset?.id === asset.id;
              const name = asset.alt || basename(asset.storage_path);
              const isPreviewing = previewURL === asset.url;

              return (
                <div key={asset.id}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-colors ${isSelected ? "border-blue-500/50 bg-blue-500/[0.04]" : "border-surface-border bg-background"}`}
                >
                  {/* Checkbox */}
                  <button type="button" onClick={() => toggleSelect(asset.id)}
                    className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-lg border border-surface-border bg-background/80 backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100 data-[selected=true]:opacity-100"
                    data-selected={isSelected}>
                    {isSelected ? <CheckSquare size={13} className="text-blue-500" /> : <Square size={13} className="text-foreground/50" />}
                  </button>

                  {/* Thumbnail / preview toggle */}
                  <div
                    className="relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden bg-black"
                    onClick={() => setPreviewURL(isPreviewing ? null : asset.url)}
                  >
                    {isPreviewing ? (
                      <div className="flex flex-col items-center gap-1 text-white/50">
                        <Play size={24} className="text-white/30" />
                        <span className="text-[10px]">Playing above</span>
                      </div>
                    ) : (
                      <>
                        {/* Native video thumbnail */}
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video src={asset.url} className="h-full w-full object-contain" preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
                            <Play size={18} className="ml-0.5 text-gray-900" />
                          </div>
                        </div>
                      </>
                    )}
                    {isDeleting && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                        <Loader2 size={20} className="animate-spin text-red-500" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-0.5 p-3">
                    <p className="truncate text-sm font-medium" title={name}>{name}</p>
                    <p className="text-xs text-foreground/45">
                      {asset.mime_type.replace("video/", "")} · {formatBytes(asset.size_bytes)} · {formatDate(asset.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-t border-surface-border px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <a href={asset.url} target="_blank" rel="noopener noreferrer"
                      className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg text-xs text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground">
                      <ExternalLink size={11} />View
                    </a>
                    <button
                      ref={(el) => { if (el) deleteButtonRefs.current.set(asset.id, el); else deleteButtonRefs.current.delete(asset.id); }}
                      type="button" disabled={isDeleting}
                      onClick={() => setConfirmAsset(isConfirming ? null : asset)}
                      className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40">
                      <Trash2 size={11} />Delete
                    </button>
                  </div>

                  {isConfirming && deleteButtonRefs.current.get(asset.id) && (
                    <DeletePopover
                      label={name}
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
