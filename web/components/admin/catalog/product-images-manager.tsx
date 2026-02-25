"use client";

import { useState, useRef } from "react";
import { Upload, Link as LinkIcon, X, Star, ImageIcon, Loader2 } from "lucide-react";
import {
  addAdminProductImage,
  removeAdminProductImage,
  setDefaultAdminProductImage,
  uploadAdminMedia,
  getAdminMedia,
  type ProductImage,
  type AdminMediaAsset,
} from "@/lib/api";

type Props = {
  productID: string;
  initialImages: ProductImage[];
};

type Tab = "upload" | "library";

export function ProductImagesManager({ productID, initialImages }: Props) {
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [tab, setTab] = useState<Tab>("upload");
  const [uploading, setUploading] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [library, setLibrary] = useState<AdminMediaAsset[] | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [altInput, setAltInput] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const asset = await uploadAdminMedia(file, file.name.replace(/\.[^.]+$/, ""));
      const img = await addAdminProductImage(productID, asset.url, asset.alt || "");
      setImages((prev) => [...prev, img]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleAddURL() {
    const url = urlInput.trim();
    if (!url) return;
    setUploading(true);
    setError(null);
    try {
      const img = await addAdminProductImage(productID, url, altInput.trim());
      setImages((prev) => [...prev, img]);
      setUrlInput("");
      setAltInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add image");
    } finally {
      setUploading(false);
    }
  }

  async function handlePickFromLibrary(asset: AdminMediaAsset) {
    setUploading(true);
    setError(null);
    try {
      const img = await addAdminProductImage(productID, asset.url, asset.alt || "");
      setImages((prev) => [...prev, img]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add image");
    } finally {
      setUploading(false);
    }
  }

  async function handleSetDefault(imageID: string) {
    setSettingDefault(imageID);
    setError(null);
    try {
      await setDefaultAdminProductImage(productID, imageID);
      setImages((prev) => prev.map((img) => ({ ...img, isDefault: img.id === imageID })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set default image");
    } finally {
      setSettingDefault(null);
    }
  }

  async function handleRemove(imageID: string) {
    setRemoving(imageID);
    setError(null);
    try {
      await removeAdminProductImage(productID, imageID);
      setImages((prev) => prev.filter((img) => img.id !== imageID));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove image");
    } finally {
      setRemoving(null);
    }
  }

  async function loadLibrary() {
    setLoadingLibrary(true);
    try {
      const res = await getAdminMedia({ limit: 50 });
      setLibrary(res.items);
    } catch {
      setError("Failed to load media library");
    } finally {
      setLoadingLibrary(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Current images */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.id} className={`group relative h-20 w-20 overflow-hidden rounded-xl border bg-foreground/[0.03] ${img.isDefault ? "border-yellow-400/60 ring-1 ring-yellow-400/40" : "border-surface-border"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt || ""} className="h-full w-full object-cover" loading="lazy" />
              {/* Set default star */}
              <button
                type="button"
                title={img.isDefault ? "Default image" : "Set as default"}
                onClick={() => !img.isDefault && handleSetDefault(img.id)}
                disabled={settingDefault === img.id || img.isDefault}
                className={`absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full transition-opacity ${
                  img.isDefault
                    ? "bg-yellow-400/90 opacity-100"
                    : "bg-black/50 opacity-0 group-hover:opacity-100 hover:bg-yellow-400/80"
                } disabled:cursor-default`}
              >
                {settingDefault === img.id
                  ? <Loader2 size={9} className="animate-spin text-white" />
                  : <Star size={9} className={img.isDefault ? "text-yellow-900 fill-yellow-900" : "text-white"} />
                }
              </button>
              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(img.id)}
                disabled={removing === img.id}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
              >
                {removing === img.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-surface-border p-3 text-xs text-foreground/50">
          <ImageIcon size={14} />
          No images yet
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Add image */}
      <div className="rounded-xl border border-surface-border bg-foreground/[0.02] overflow-hidden">
        <div className="flex border-b border-surface-border">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${tab === "upload" ? "bg-background text-foreground" : "text-foreground/50 hover:text-foreground"}`}
          >
            <Upload size={12} />
            Upload / URL
          </button>
          <button
            type="button"
            onClick={() => { setTab("library"); if (!library) loadLibrary(); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${tab === "library" ? "bg-background text-foreground" : "text-foreground/50 hover:text-foreground"}`}
          >
            <ImageIcon size={12} />
            Media Library
          </button>
        </div>

        <div className="p-3">
          {tab === "upload" && (
            <div className="flex flex-col gap-2">
              {/* File drop zone */}
              <div
                className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-surface-border p-3 text-xs text-foreground/50 transition-colors hover:border-blue-500/40 hover:bg-blue-500/[0.03]"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                {uploading ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <Upload size={16} />}
                <span>{uploading ? "Uploading..." : "Drop file or click to upload"}</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />

              <div className="flex items-center gap-1 text-xs text-foreground/40">
                <div className="h-px flex-1 bg-surface-border" />
                <span>or paste URL</span>
                <div className="h-px flex-1 bg-surface-border" />
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddURL(); } }}
                  className="min-w-0 flex-1 rounded-lg border border-surface-border bg-background px-2 py-1.5 text-xs outline-none focus:border-blue-500/50"
                />
                <button
                  type="button"
                  onClick={handleAddURL}
                  disabled={!urlInput.trim() || uploading}
                  className="flex items-center gap-1 rounded-lg border border-blue-500/35 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-700 disabled:opacity-40 dark:text-blue-300"
                >
                  <LinkIcon size={11} />
                  Add
                </button>
              </div>
            </div>
          )}

          {tab === "library" && (
            <div>
              {loadingLibrary && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={18} className="animate-spin text-foreground/40" />
                </div>
              )}
              {!loadingLibrary && library && library.length === 0 && (
                <p className="py-3 text-center text-xs text-foreground/50">No media assets uploaded yet.</p>
              )}
              {!loadingLibrary && library && library.length > 0 && (
                <div className="grid max-h-48 grid-cols-5 gap-1.5 overflow-y-auto">
                  {library.map((asset) => {
                    const alreadyAdded = images.some((img) => img.url === asset.url);
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        disabled={alreadyAdded || uploading}
                        onClick={() => handlePickFromLibrary(asset)}
                        className={`group relative h-16 overflow-hidden rounded-lg border transition-colors ${alreadyAdded ? "border-emerald-500/40 opacity-50 cursor-default" : "border-surface-border hover:border-blue-500/40"}`}
                        title={asset.alt || asset.url}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt={asset.alt || ""} className="h-full w-full object-cover" loading="lazy" />
                        {!alreadyAdded && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
                            <span className="text-[10px] font-semibold text-white">Add</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
