"use client";

import { useMemo, useState } from "react";
import type { AdminMediaAsset } from "@/lib/api";

type CategoryMediaPickerProps = {
  mediaAssets: AdminMediaAsset[];
  mediaLoadError: string | null;
  defaultImageURL: string;
  uploadAction: (formData: FormData) => Promise<void>;
  importAction: (formData: FormData) => Promise<void>;
};

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** idx;
  const digits = scaled >= 10 || idx === 0 ? 0 : 1;
  return `${scaled.toFixed(digits)} ${units[idx]}`;
}

export function CategoryMediaPicker({
  mediaAssets,
  mediaLoadError,
  defaultImageURL,
  uploadAction,
  importAction,
}: CategoryMediaPickerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedURL, setSelectedURL] = useState(defaultImageURL);

  const selectedAsset = useMemo(
    () => mediaAssets.find((asset) => asset.url === selectedURL) ?? null,
    [mediaAssets, selectedURL],
  );

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return mediaAssets;
    return mediaAssets.filter((asset) => {
      const title = asset.alt || asset.id;
      return (
        title.toLowerCase().includes(query) ||
        asset.mime_type.toLowerCase().includes(query) ||
        asset.url.toLowerCase().includes(query)
      );
    });
  }, [mediaAssets, search]);

  const selectedLabel = selectedAsset?.alt || selectedAsset?.id.slice(0, 8) || "No media selected";

  return (
    <div className="space-y-3 rounded-xl border border-surface-border bg-foreground/[0.02] p-3">
      <label className="space-y-1 text-sm">
        <span>Image URL (manual fallback)</span>
        <input
          name="default_image_url"
          type="url"
          defaultValue={defaultImageURL}
          placeholder="https://..."
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
        />
      </label>

      <input type="hidden" name="media_selected_url" value={selectedURL} />
      <div className="space-y-2 text-sm">
        <span>Select from media library</span>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-surface-border bg-background p-2">
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
          >
            Open media library
          </button>
          <button
            type="button"
            onClick={() => setSelectedURL("")}
            className="rounded-lg border border-surface-border bg-foreground/[0.02] px-3 py-2 text-sm"
          >
            Use manual URL
          </button>
          <span className="text-xs text-foreground/65">
            {selectedAsset ? `Selected: ${selectedLabel}` : "No media selected"}
          </span>
        </div>

        {selectedAsset && (
          <div className="overflow-hidden rounded-xl border border-surface-border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedAsset.url} alt={selectedAsset.alt || "Selected media preview"} className="h-28 w-full object-cover" loading="lazy" />
            <div className="grid gap-0.5 px-3 py-2 text-xs text-foreground/70">
              <p className="truncate font-medium text-foreground">{selectedLabel}</p>
              <p>{selectedAsset.mime_type}</p>
              <p>{formatBytes(selectedAsset.size_bytes)}</p>
            </div>
          </div>
        )}
      </div>

      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
              <div>
                <h3 className="text-base font-semibold">Media library</h3>
                <p className="text-xs text-foreground/65">Select an image and click &quot;Use selected image&quot;.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="border-b border-surface-border px-4 py-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title, URL, or mime type"
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {filteredAssets.length === 0 ? (
                <p className="rounded-xl border border-surface-border bg-foreground/[0.02] p-4 text-sm text-foreground/70">
                  No media found for this search.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredAssets.map((asset) => {
                    const isSelected = selectedURL === asset.url;
                    const title = asset.alt || `Asset ${asset.id.slice(0, 8)}`;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedURL(asset.url)}
                        className={`overflow-hidden rounded-xl border text-left transition ${
                          isSelected
                            ? "border-blue-500 ring-2 ring-blue-500/25"
                            : "border-surface-border hover:border-blue-400/60"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt={asset.alt || "Media asset preview"} className="h-36 w-full bg-foreground/[0.03] object-cover" loading="lazy" />
                        <div className="space-y-0.5 px-3 py-2">
                          <p className="truncate text-sm font-medium">{title}</p>
                          <p className="truncate text-xs text-foreground/70">{asset.mime_type}</p>
                          <p className="text-xs text-foreground/70">{formatBytes(asset.size_bytes)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-surface-border px-4 py-3">
              <p className="truncate text-xs text-foreground/65">
                {selectedAsset ? `Selected: ${selectedLabel}` : "No image selected"}
              </p>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
              >
                Use selected image
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-foreground/65">Choose image in popup, then submit create/save.</p>

      {mediaLoadError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {mediaLoadError}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-surface-border bg-background/70 p-3">
          <p className="text-sm font-medium">Upload image</p>
          <input
            name="media_upload_file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-surface-border file:bg-foreground/[0.02] file:px-3 file:py-2"
          />
          <input
            name="media_upload_alt"
            placeholder="Alt text (optional)"
            className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            formAction={uploadAction}
            formNoValidate
            className="w-full rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/18 dark:text-emerald-300"
          >
            Upload to library
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-surface-border bg-background/70 p-3">
          <p className="text-sm font-medium">Import from URL</p>
          <input
            name="media_import_url"
            type="url"
            placeholder="https://example.com/image.png"
            className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
          />
          <input
            name="media_import_alt"
            placeholder="Alt text (optional)"
            className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-start gap-2 text-xs text-foreground/75">
            <input name="media_import_consent" type="checkbox" value="yes" className="mt-0.5 h-4 w-4 rounded border-surface-border" />
            <span>I confirm I have rights to import this image and it is safe to use.</span>
          </label>
          <button
            type="submit"
            formAction={importAction}
            formNoValidate
            className="w-full rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
          >
            Import URL to library
          </button>
        </div>
      </div>
    </div>
  );
}
