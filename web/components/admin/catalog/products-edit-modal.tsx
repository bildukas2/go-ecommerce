"use client";

import { useState } from "react";
import type { AdminCustomOption, AdminProductCustomOptionAssignment } from "@/lib/api";
import { CustomOptionAssignmentPicker } from "./custom-option-assignment-picker";

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
  assignments: AdminProductCustomOptionAssignment[];
  product: EditableProduct;
};

export function ProductsEditModal({ updateAction, returnTo, categories, customOptions, assignments, product }: Props) {
  const [open, setOpen] = useState(false);
  const [customOptionPick, setCustomOptionPick] = useState("");
  const [selectedCustomOptionIDs, setSelectedCustomOptionIDs] = useState<string[]>([]);
  const [removedCustomOptionIDs, setRemovedCustomOptionIDs] = useState<string[]>([]);

  const toggleRemoveOption = (optionID: string) => {
    setRemovedCustomOptionIDs((prev) => (prev.includes(optionID) ? prev.filter((id) => id !== optionID) : [...prev, optionID]));
  };

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
                <span>Customizable options</span>
                <CustomOptionAssignmentPicker
                  options={customOptions}
                  pickerListID={`edit-product-custom-options-list-${product.id}`}
                  pickerValue={customOptionPick}
                  selectedOptionIDs={selectedCustomOptionIDs}
                  onPickerValueChange={setCustomOptionPick}
                  onSelectedOptionIDsChange={setSelectedCustomOptionIDs}
                />
                <input type="hidden" name="option_pick" value={customOptionPick} />
                {selectedCustomOptionIDs.map((optionID) => (
                  <input key={`edit-hidden-option-${product.id}-${optionID}`} type="hidden" name="option_ids" value={optionID} />
                ))}
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
                  {removedCustomOptionIDs.map((optionID) => (
                    <input key={`edit-remove-option-${product.id}-${optionID}`} type="hidden" name="remove_option_ids" value={optionID} />
                  ))}
                </div>
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
