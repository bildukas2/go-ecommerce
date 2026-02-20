"use client";

import { useState } from "react";
import type { AdminCustomOption } from "@/lib/api";

type ActionFn = (formData: FormData) => void | Promise<void>;

type EditableProduct = {
  id: string;
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
  updateAction: ActionFn;
  returnTo: string;
  categories: Array<{ id: string; name: string }>;
  customOptions: Array<Pick<AdminCustomOption, "id" | "title" | "type_group" | "type">>;
  product: EditableProduct;
};

export function ProductsEditModal({ updateAction, returnTo, categories, customOptions, product }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium hover:bg-foreground/[0.05]"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
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

            <form action={updateAction} className="grid gap-3 p-4 md:grid-cols-2">
              <input type="hidden" name="return_to" value={returnTo} />
              <input type="hidden" name="product_id" value={product.id} />
              <label className="space-y-1 text-sm">
                <span>Title</span>
                <input
                  name="title"
                  required
                  defaultValue={product.title}
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Slug</span>
                <input
                  name="slug"
                  required
                  defaultValue={product.slug}
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>SKU</span>
                <input
                  name="sku"
                  required
                  defaultValue={product.sku}
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Stock</span>
                <input
                  name="stock"
                  type="number"
                  min="0"
                  required
                  defaultValue={String(product.stock)}
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Base price</span>
                <input
                  name="base_price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={product.basePrice}
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Status</span>
                <select
                  name="status"
                  defaultValue={product.status || "published"}
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                >
                  <option value="published">Published</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span>Categories (multi-select)</span>
                <select multiple name="category_ids" className="h-28 w-full rounded-xl border border-surface-border bg-background px-3 py-2">
                  {categories.map((category) => (
                    <option key={`${product.id}-category-${category.id}`} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span>Customizable options (optional)</span>
                <input
                  name="option_pick"
                  list={`edit-product-custom-options-list-${product.id}`}
                  placeholder="Type to search option title or paste ID"
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
                <datalist id={`edit-product-custom-options-list-${product.id}`}>
                  {customOptions.map((option) => (
                    <option key={`edit-option-pick-${product.id}-${option.id}`} value={`${option.title} (${option.id})`} />
                  ))}
                </datalist>
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span>Customizable options (multi-select)</span>
                <select multiple name="option_ids" className="h-28 w-full rounded-xl border border-surface-border bg-background px-3 py-2">
                  {customOptions.map((option) => (
                    <option key={`edit-option-${product.id}-${option.id}`} value={option.id}>
                      {option.title} ({option.type_group}/{option.type})
                    </option>
                  ))}
                </select>
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
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={product.description}
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
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
                <input
                  name="discount_value"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="10 or 15.5"
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>SEO title</span>
                <input
                  name="seo_title"
                  maxLength={120}
                  defaultValue={product.seoTitle ?? ""}
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>SEO description</span>
                <input
                  name="seo_description"
                  maxLength={320}
                  defaultValue={product.seoDescription ?? ""}
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span>Tags (comma-separated)</span>
                <input
                  name="tags"
                  defaultValue={product.tags.join(", ")}
                  className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="md:col-span-2 rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
              >
                Save product
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
