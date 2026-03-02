"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  applyAdminProductDiscount,
  attachAdminProductCustomOption,
  bulkAssignAdminProductCategories,
  createAdminProduct,
  createAdminProductVariant,
  type AdminCustomOption,
} from "@/lib/api";
import { attachCustomOptionsIgnoringConflicts } from "@/lib/admin-catalog-state";
import { CustomOptionAssignmentPicker } from "./custom-option-assignment-picker";
import { ProductImagesManager } from "./product-images-manager";

type Props = {
  returnTo: string;
  categories: Array<{ id: string; name: string }>;
  customOptions: Array<Pick<AdminCustomOption, "id" | "title" | "type_group" | "type">>;
  onCreated?: () => void | Promise<void>;
};

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductsCreateModal({ returnTo, categories, customOptions, onCreated }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [customOptionPick, setCustomOptionPick] = useState("");
  const [selectedCustomOptionIDs, setSelectedCustomOptionIDs] = useState<string[]>([]);

  // Slug auto-fill state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const slugManuallyEdited = useRef(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdProductID, setCreatedProductID] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setTitle(value);
    if (!slugManuallyEdited.current) {
      setSlug(generateSlug(value));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    slugManuallyEdited.current = true;
    setSlug(e.target.value);
  }

  function resetModal() {
    setTitle("");
    setSlug("");
    slugManuallyEdited.current = false;
    setCustomOptionPick("");
    setSelectedCustomOptionIDs([]);
    setSubmitting(false);
    setSubmitError(null);
    setCreatedProductID(null);
  }

  async function handleClose() {
    if (createdProductID) {
      await onCreated?.();
      router.refresh();
    }
    setOpen(false);
    setTimeout(resetModal, 200);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const titleVal = title.trim();
    const slugVal = slug.trim();
    const sku = String(data.get("sku") ?? "").trim();
    const stockRaw = String(data.get("stock") ?? "0");
    const stock = Number.parseInt(stockRaw, 10);
    const basePriceRaw = String(data.get("base_price") ?? "").trim();
    const basePriceCents = Math.round(Number.parseFloat(basePriceRaw) * 100);
    const status = String(data.get("status") ?? "published").trim().toLowerCase();
    const description = String(data.get("description") ?? "").trim();
    const tagsRaw = String(data.get("tags") ?? "");
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const seoTitle = String(data.get("seo_title") ?? "").trim() || null;
    const seoDesc = String(data.get("seo_description") ?? "").trim() || null;
    const discountType = String(data.get("discount_type") ?? "none").trim().toLowerCase();
    const discountRaw = String(data.get("discount_value") ?? "").trim();
    const sortOrder = Number.parseInt(String(data.get("sort_order") ?? "0"), 10) || 0;

    const categoryIDs: string[] = [];
    for (const val of data.getAll("category_ids")) {
      if (typeof val === "string" && val.trim()) categoryIDs.push(val.trim());
    }

    if (!titleVal || !slugVal || !sku || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(basePriceCents) || basePriceCents <= 0) {
      setSubmitError("Please fill in all required fields correctly.");
      setSubmitting(false);
      return;
    }

    try {
      const created = await createAdminProduct({
        slug: slugVal,
        title: titleVal,
        description,
        status,
        tags,
        seo_title: seoTitle,
        seo_description: seoDesc,
      });

      await createAdminProductVariant(created.id, {
        sku,
        price_cents: basePriceCents,
        stock,
        currency: "USD",
      });

      if (categoryIDs.length > 0) {
        await bulkAssignAdminProductCategories({ product_ids: [created.id], category_ids: categoryIDs });
      }

      if (selectedCustomOptionIDs.length > 0) {
        await attachCustomOptionsIgnoringConflicts({
          productIDs: [created.id],
          optionIDs: selectedCustomOptionIDs,
          sortOrder,
          attach: attachAdminProductCustomOption,
        });
      }

      if (discountType !== "none" && discountRaw) {
        if (discountType === "percent") {
          const percent = Number.parseFloat(discountRaw);
          if (Number.isFinite(percent) && percent > 0 && percent < 100) {
            await applyAdminProductDiscount(created.id, { mode: "percent", discount_percent: percent });
          }
        } else if (discountType === "flat") {
          const flatCents = Math.round(Number.parseFloat(discountRaw) * 100);
          if (Number.isFinite(flatCents) && flatCents > 0 && flatCents < basePriceCents) {
            await applyAdminProductDiscount(created.id, { mode: "price", discount_price_cents: basePriceCents - flatCents });
          }
        }
      }

      setCreatedProductID(created.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  }

  const modal = open ? (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h2 className="text-lg font-semibold">{createdProductID ? "Add images (optional)" : "Create product"}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm"
          >
            {createdProductID ? "Done" : "Close"}
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          {createdProductID && (
            <div className="md:col-span-2 space-y-2">
              <p className="text-sm font-medium">Images</p>
              <ProductImagesManager productID={createdProductID} initialImages={[]} />
              <div className="border-b border-surface-border" />
            </div>
          )}
          {!createdProductID ? (
          <form onSubmit={handleSubmit} className="contents">
            <label className="space-y-1 text-sm">
              <span>Title</span>
              <input
                name="title"
                required
                value={title}
                onChange={handleTitleChange}
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Slug</span>
              <input
                name="slug"
                required
                placeholder="everyday-hoodie"
                value={slug}
                onChange={handleSlugChange}
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>SKU</span>
              <input name="sku" required placeholder="SOFA-10058" className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span>Stock</span>
              <input name="stock" type="number" min="0" defaultValue="0" required className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span>Base price</span>
              <input name="base_price" type="number" min="0" step="0.01" required placeholder="199.99" className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span>Status</span>
              <select name="status" defaultValue="published" className="w-full rounded-xl border border-surface-border bg-background px-3 py-2">
                <option value="published">Published</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>Categories (multi-select)</span>
              <select multiple name="category_ids" className="h-28 w-full rounded-xl border border-surface-border bg-background px-3 py-2">
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>Customizable options</span>
              <CustomOptionAssignmentPicker
                options={customOptions}
                pickerListID="create-product-custom-options-list"
                pickerValue={customOptionPick}
                selectedOptionIDs={selectedCustomOptionIDs}
                onPickerValueChange={setCustomOptionPick}
                onSelectedOptionIDsChange={setSelectedCustomOptionIDs}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Custom option sort order</span>
              <input
                name="sort_order"
                type="number"
                defaultValue="0"
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>Description</span>
              <textarea name="description" rows={3} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span>Discount type (optional)</span>
              <select name="discount_type" defaultValue="none" className="w-full rounded-xl border border-surface-border bg-background px-3 py-2">
                <option value="none">No Discount</option>
                <option value="flat">Flat Discount</option>
                <option value="percent">Percentage Discount</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Discount value (optional)</span>
              <input name="discount_value" type="number" min="0" step="0.01" placeholder="10 or 15.5" className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span>SEO title</span>
              <input name="seo_title" maxLength={120} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span>SEO description</span>
              <input name="seo_description" maxLength={320} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>Tags (comma-separated)</span>
              <input name="tags" placeholder="furniture, living room, featured" className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            {submitError && (
              <p className="text-sm text-red-600 md:col-span-2">{submitError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="md:col-span-2 rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create product"}
            </button>
          </form>
          ) : (
            <p className="md:col-span-2 text-sm text-emerald-600">Product created. Add images above or click Done to finish.</p>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
      >
        Create product
      </button>

      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
