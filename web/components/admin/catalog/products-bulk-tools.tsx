"use client";

import { useState } from "react";
import {
  calculateDiscountPreview,
  hasBulkCustomOptionPayload,
  parseDiscountDraft,
  resolveCustomOptionIDs,
} from "@/lib/admin-catalog-state";
import { formatMoney } from "@/lib/money";
import type { AdminCustomOption } from "@/lib/api";
import { CustomOptionAssignmentPicker } from "./custom-option-assignment-picker";

type ProductOption = {
  id: string;
  title: string;
  slug: string;
  basePriceCents: number | null;
  currency: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type CustomOption = Pick<AdminCustomOption, "id" | "title" | "type_group" | "type">;

type ActionFn = (formData: FormData) => void | Promise<void>;

type Props = {
  products: ProductOption[];
  categories: CategoryOption[];
  customOptions: CustomOption[];
  selectedProductIDs: string[];
  bulkAssignAction: ActionFn;
  bulkRemoveAction: ActionFn;
  bulkDiscountAction: ActionFn;
  bulkAttachCustomOptionsAction: ActionFn;
  returnTo: string;
};

export function ProductsBulkTools({
  products,
  categories,
  customOptions,
  selectedProductIDs,
  bulkAssignAction,
  bulkRemoveAction,
  bulkDiscountAction,
  bulkAttachCustomOptionsAction,
  returnTo,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedCategoryIDs, setSelectedCategoryIDs] = useState<string[]>([]);
  const [discountMode, setDiscountMode] = useState<"price" | "percent">("percent");
  const [discountValue, setDiscountValue] = useState<string>("10");
  const [customOptionPick, setCustomOptionPick] = useState<string>("");
  const [selectedCustomOptionIDs, setSelectedCustomOptionIDs] = useState<string[]>([]);
  const [customOptionSortOrder, setCustomOptionSortOrder] = useState<string>("0");

  const draft = parseDiscountDraft(discountMode, discountValue);
  const resolvedCustomOptionIDs = resolveCustomOptionIDs(selectedCustomOptionIDs, customOptionPick);
  const previewProduct = products.find((item) => selectedProductIDs.includes(item.id)) ?? null;
  const preview = previewProduct && previewProduct.basePriceCents !== null
    ? calculateDiscountPreview(previewProduct.basePriceCents, draft.mode, draft.value)
    : { valid: false, discountedPriceCents: null };
  const previewMessage = previewProduct && previewProduct.basePriceCents !== null && preview.valid && preview.discountedPriceCents !== null
    ? `Preview for ${previewProduct.title}: ${formatMoney(previewProduct.basePriceCents, previewProduct.currency)} -> ${formatMoney(preview.discountedPriceCents, previewProduct.currency)}`
    : "Select a product with a valid base price and discount value to preview.";

  const hasBulkCategoryPayload = selectedProductIDs.length > 0 && selectedCategoryIDs.length > 0;
  const hasBulkDiscountPayload = selectedProductIDs.length > 0 && preview.valid;
  const hasBulkCustomOptions = hasBulkCustomOptionPayload(selectedProductIDs, selectedCustomOptionIDs, customOptionPick);

  return (
    <>
      <button
        type="button"
        disabled={selectedProductIDs.length === 0}
        onClick={() => setOpen(true)}
        className="w-fit rounded-xl border border-surface-border bg-foreground/[0.02] px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Open bulk tools ({selectedProductIDs.length} selected)
      </button>

      {open && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-surface-border px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold">Bulk tools</h2>
                <p className="text-sm text-foreground/65">Run category or discount operations for the {selectedProductIDs.length} selected products.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-surface-border px-3 py-1.5 text-sm"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="max-h-[calc(90vh-72px)] overflow-auto p-4">
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Categories for assign/remove</p>
                    <select
                      multiple
                      value={selectedCategoryIDs}
                      onChange={(event) => setSelectedCategoryIDs(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
                      className="h-32 w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <form action={bulkAssignAction}>
                      <input type="hidden" name="return_to" value={returnTo} />
                      {selectedProductIDs.map((id) => <input key={`assign-p-${id}`} type="hidden" name="product_ids" value={id} />)}
                      {selectedCategoryIDs.map((id) => <input key={`assign-c-${id}`} type="hidden" name="category_ids" value={id} />)}
                      <button
                        type="submit"
                        disabled={!hasBulkCategoryPayload}
                        className="w-full rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
                      >
                        Bulk assign categories
                      </button>
                    </form>

                    <form action={bulkRemoveAction}>
                      <input type="hidden" name="return_to" value={returnTo} />
                      {selectedProductIDs.map((id) => <input key={`remove-p-${id}`} type="hidden" name="product_ids" value={id} />)}
                      {selectedCategoryIDs.map((id) => <input key={`remove-c-${id}`} type="hidden" name="category_ids" value={id} />)}
                      <button
                        type="submit"
                        disabled={!hasBulkCategoryPayload}
                        className="w-full rounded-xl border border-amber-500/35 bg-amber-500/12 px-3 py-2 text-sm font-medium text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-300"
                      >
                        Bulk remove categories
                      </button>
                    </form>
                  </div>

                  <div className="rounded-xl border border-surface-border p-3">
                    <p className="text-sm font-medium">Bulk discount</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[auto,1fr]">
                      <select
                        value={discountMode}
                        onChange={(event) => setDiscountMode(event.target.value as "price" | "percent")}
                        className="rounded-lg border border-surface-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="percent">Percent %</option>
                        <option value="price">Static price (cents)</option>
                      </select>
                      <input
                        type="number"
                        min={discountMode === "percent" ? 0 : 0}
                        step={discountMode === "percent" ? "0.01" : "1"}
                        value={discountValue}
                        onChange={(event) => setDiscountValue(event.target.value)}
                        className="rounded-lg border border-surface-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <p className="mt-2 text-xs text-foreground/65">
                      {previewMessage}
                    </p>
                    <form action={bulkDiscountAction} className="mt-3">
                      <input type="hidden" name="return_to" value={returnTo} />
                      {selectedProductIDs.map((id) => <input key={`discount-p-${id}`} type="hidden" name="product_ids" value={id} />)}
                      <input type="hidden" name="mode" value={draft.mode} />
                      {draft.mode === "percent" ? (
                        <input type="hidden" name="discount_percent" value={String(draft.value)} />
                      ) : (
                        <input type="hidden" name="discount_price_cents" value={String(Math.round(draft.value))} />
                      )}
                      <button
                        type="submit"
                        disabled={!hasBulkDiscountPayload}
                        className="w-full rounded-xl border border-blue-500/35 bg-blue-500/12 px-3 py-2 text-sm font-medium text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300"
                      >
                        Apply bulk discount
                      </button>
                    </form>
                  </div>

                  <div className="rounded-xl border border-surface-border p-3">
                    <p className="text-sm font-medium">Customizable options</p>
                    <div className="mt-2 space-y-2">
                      <CustomOptionAssignmentPicker
                        options={customOptions}
                        pickerListID="bulk-custom-options-list"
                        pickerValue={customOptionPick}
                        selectedOptionIDs={selectedCustomOptionIDs}
                        onPickerValueChange={setCustomOptionPick}
                        onSelectedOptionIDsChange={setSelectedCustomOptionIDs}
                      />

                      <label className="block text-xs text-foreground/70">
                        Sort order
                        <input
                          type="number"
                          name="sort_order"
                          value={customOptionSortOrder}
                          onChange={(event) => setCustomOptionSortOrder(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <form action={bulkAttachCustomOptionsAction} className="mt-3">
                      <input type="hidden" name="return_to" value={returnTo} />
                      {selectedProductIDs.map((id) => <input key={`option-p-${id}`} type="hidden" name="product_ids" value={id} />)}
                      {resolvedCustomOptionIDs.map((id) => <input key={`option-o-${id}`} type="hidden" name="option_ids" value={id} />)}
                      <input type="hidden" name="sort_order" value={customOptionSortOrder} />
                      <input type="hidden" name="option_pick" value={customOptionPick} />
                      <button
                        type="submit"
                        disabled={!hasBulkCustomOptions}
                        className="w-full rounded-xl border border-fuchsia-500/35 bg-fuchsia-500/12 px-3 py-2 text-sm font-medium text-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-fuchsia-300"
                      >
                        Bulk assign customizable options
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
