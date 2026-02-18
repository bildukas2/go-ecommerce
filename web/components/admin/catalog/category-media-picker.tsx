import type { AdminMediaAsset } from "@/lib/api";

type CategoryMediaPickerProps = {
  mediaAssets: AdminMediaAsset[];
  mediaLoadError: string | null;
  defaultImageURL: string;
  uploadAction: (formData: FormData) => Promise<void>;
  importAction: (formData: FormData) => Promise<void>;
};

export function CategoryMediaPicker({
  mediaAssets,
  mediaLoadError,
  defaultImageURL,
  uploadAction,
  importAction,
}: CategoryMediaPickerProps) {
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

      <label className="space-y-1 text-sm">
        <span>Select from media library</span>
        <select
          name="media_selected_url"
          defaultValue=""
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
        >
          <option value="">Keep manual URL</option>
          {mediaAssets.map((asset) => (
            <option key={asset.id} value={asset.url}>
              {asset.alt ? `${asset.alt} (${asset.mime_type})` : `${asset.mime_type} - ${asset.id.slice(0, 8)}`}
            </option>
          ))}
        </select>
        <p className="text-xs text-foreground/65">Choose an asset here, then submit create/save to apply it.</p>
      </label>

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
