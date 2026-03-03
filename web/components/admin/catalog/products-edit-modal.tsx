"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  applyAdminProductDiscount,
  attachAdminProductCustomOption,
  detachAdminProductCustomOption,
  getAdminProductCategoryIDs,
  setAdminProductCategories,
  updateAdminProduct,
  updateAdminProductVariant,
  type AdminCustomOption,
  type AdminProductCustomOptionAssignment,
  type ProductImage,
} from "@/lib/api";
import { attachCustomOptionsIgnoringConflicts } from "@/lib/admin-catalog-state";
import { CustomOptionAssignmentPicker } from "./custom-option-assignment-picker";
import { ProductImagesManager } from "./product-images-manager";

type EditableProduct = {
  id: string;
  variantID: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  tags: string[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  sku: string;
  stock: number;
  basePrice: string;
};

type Props = {
  categories: Array<{ id: string; name: string }>;
  customOptions: Array<Pick<AdminCustomOption, "id" | "title" | "type_group" | "type">>;
  assignments: AdminProductCustomOptionAssignment[];
  product: EditableProduct;
  images?: ProductImage[];
  onSaved?: () => void | Promise<void>;
};

export function ProductsEditModal({ categories, customOptions, assignments, product, images = [], onSaved }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [customOptionPick, setCustomOptionPick] = useState("");
  const [selectedCustomOptionIDs, setSelectedCustomOptionIDs] = useState<string[]>([]);
  const [removedCustomOptionIDs, setRemovedCustomOptionIDs] = useState<string[]>([]);
  const [assignedCategoryIDs, setAssignedCategoryIDs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    getAdminProductCategoryIDs(product.id).then(setAssignedCategoryIDs).catch(() => {});
  }, [open, product.id]);

  const toggleRemoveOption = (optionID: string) => {
    setRemovedCustomOptionIDs((prev) =>
      prev.includes(optionID) ? prev.filter((id) => id !== optionID) : [...prev, optionID],
    );
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const data = new FormData(e.currentTarget);

    const slug = String(data.get("slug") ?? "").trim();
    const title = String(data.get("title") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const status = String(data.get("status") ?? "published").trim().toLowerCase();
    const tagsRaw = String(data.get("tags") ?? "");
    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
    const seoTitle = String(data.get("seo_title") ?? "").trim() || null;
    const seoDesc = String(data.get("seo_description") ?? "").trim() || null;

    const sku = String(data.get("sku") ?? "").trim();
    const stock = Number.parseInt(String(data.get("stock") ?? "0"), 10);
    const basePriceCents = Math.round(Number.parseFloat(String(data.get("base_price") ?? "0")) * 100);

    const categoryIDs: string[] = [];
    for (const val of data.getAll("category_ids")) {
      if (typeof val === "string" && val.trim()) categoryIDs.push(val.trim());
    }

    const discountType = String(data.get("discount_type") ?? "none").trim().toLowerCase();
    const discountRaw = String(data.get("discount_value") ?? "").trim();
    const sortOrder = Number.parseInt(String(data.get("sort_order") ?? "0"), 10) || 0;

    try {
      await updateAdminProduct(product.id, { slug, title, description, status, tags, seo_title: seoTitle, seo_description: seoDesc });

      if (product.variantID) {
        await updateAdminProductVariant(product.id, product.variantID, {
          sku,
          price_cents: basePriceCents,
          stock,
        });
      }

      if (categoryIDs.length > 0) {
        await setAdminProductCategories(product.id, categoryIDs);
      }

      if (selectedCustomOptionIDs.length > 0) {
        await attachCustomOptionsIgnoringConflicts({
          productIDs: [product.id],
          optionIDs: selectedCustomOptionIDs,
          sortOrder,
          attach: attachAdminProductCustomOption,
        });
      }

      if (removedCustomOptionIDs.length > 0) {
        await Promise.all(removedCustomOptionIDs.map((optionID) => detachAdminProductCustomOption(product.id, optionID)));
      }

      if (discountType !== "none" && discountRaw) {
        if (discountType === "percent") {
          const percent = Number.parseFloat(discountRaw);
          if (Number.isFinite(percent) && percent > 0 && percent < 100) {
            await applyAdminProductDiscount(product.id, { mode: "percent", discount_percent: percent });
          }
        } else if (discountType === "flat") {
          const flatCents = Math.round(Number.parseFloat(discountRaw) * 100);
          if (Number.isFinite(flatCents) && flatCents > 0 && flatCents < basePriceCents) {
            await applyAdminProductDiscount(product.id, { mode: "price", discount_price_cents: basePriceCents - flatCents });
          }
        }
      }

      await onSaved?.();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSubmitting(false);
    }
  }

  const modal = open ? (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h2 className="text-lg font-semibold">Edit product</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm"
          >
            Close
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          <div className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium">Images</span>
            <ProductImagesManager productID={product.id} initialImages={images} />
          </div>
          <label className="space-y-1 text-sm">
            <span>Title</span>
            <input name="title" required defaultValue={product.title} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Slug</span>
            <input name="slug" required defaultValue={product.slug} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>SKU</span>
            <input name="sku" required defaultValue={product.sku} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Stock</span>
            <input name="stock" type="number" min="0" required defaultValue={String(product.stock)} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Base price</span>
            <input name="base_price" type="number" min="0" step="0.01" required defaultValue={product.basePrice} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Status</span>
            <select name="status" defaultValue={product.status || "published"} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2">
              <option value="published">Published</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Categories (multi-select)</span>
            <select
              multiple
              name="category_ids"
              value={assignedCategoryIDs}
              onChange={(e) => setAssignedCategoryIDs(Array.from(e.target.selectedOptions, (o) => o.value))}
              className="h-28 w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            >
              {categories.map((category) => (
                <option key={`${product.id}-category-${category.id}`} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Customizable options</span>
            <CustomOptionAssignmentPicker
              options={customOptions}
              pickerListID={`edit-product-custom-options-list-${product.id}`}
              pickerValue={customOptionPick}
              selectedOptionIDs={selectedCustomOptionIDs}
              onPickerValueChange={setCustomOptionPick}
              onSelectedOptionIDsChange={setSelectedCustomOptionIDs}
            />
            <div className="rounded-xl border border-surface-border bg-foreground/[0.02] px-3 py-2">
              <p className="text-xs font-medium text-purple-800 dark:text-purple-400">Currently attached options</p>
              {assignments.length === 0 ? (
                <p className="mt-1 text-xs text-foreground/65">No customizable options attached.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs text-foreground/75">
                  {assignments.map((assignment) => {
                    const isRemoved = removedCustomOptionIDs.includes(assignment.option_id);
                    return (
                      <li key={`${product.id}-attached-${assignment.option_id}`} className="flex items-center justify-between gap-2">
                        <span className={isRemoved ? "line-through opacity-60" : ""}>
                          {assignment.option?.title || assignment.option_id} ({assignment.option?.type_group || "unknown"}/
                          {assignment.option?.type || "unknown"})
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleRemoveOption(assignment.option_id)}
                          className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                            isRemoved
                              ? "border-surface-border bg-background text-foreground/75"
                              : "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300"
                          }`}
                        >
                          {isRemoved ? "Undo" : "Remove"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </label>
          <label className="space-y-1 text-sm">
            <span>Custom option sort order</span>
            <input name="sort_order" type="number" defaultValue="0" className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Description</span>
            <textarea name="description" rows={3} defaultValue={product.description} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
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
            <input name="seo_title" maxLength={120} defaultValue={product.seoTitle ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>SEO description</span>
            <input name="seo_description" maxLength={320} defaultValue={product.seoDescription ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Tags (comma-separated)</span>
            <input name="tags" defaultValue={product.tags.join(", ")} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
          </label>
          {submitError && <p className="text-sm text-red-600 md:col-span-2">{submitError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="md:col-span-2 rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save product"}
          </button>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium hover:bg-foreground/[0.05]"
      >
        Edit
      </button>

      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
