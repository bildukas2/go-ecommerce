"use client";

import { useMemo, useState } from "react";
import { calculateDiscountPreview, isEveryProductSelected, parseDiscountDraft, toggleProductSelection } from "@/lib/admin-catalog-state";
import { formatMoney } from "@/lib/money";

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

type ActionFn = (formData: FormData) => void | Promise<void>;

type Props = {
  products: ProductOption[];
  categories: CategoryOption[];
  bulkAssignAction: ActionFn;
  bulkRemoveAction: ActionFn;
  bulkDiscountAction: ActionFn;
  returnTo: string;
};

export function ProductsBulkTools({
  products,
  categories,
  bulkAssignAction,
  bulkRemoveAction,
  bulkDiscountAction,
  returnTo,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedProductIDs, setSelectedProductIDs] = useState<string[]>([]);
  const [selectedCategoryIDs, setSelectedCategoryIDs] = useState<string[]>([]);
  const [discountMode, setDiscountMode] = useState<"price" | "percent">("percent");
  const [discountValue, setDiscountValue] = useState<string>("10");

  const allProductIDs = useMemo(() => products.map((item) => item.id), [products]);
  const allSelected = isEveryProductSelected(allProductIDs, selectedProductIDs);
  const draft = parseDiscountDraft(discountMode, discountValue);
  const previewProduct = products.find((item) => selectedProductIDs.includes(item.id)) ?? null;
  const preview = previewProduct && previewProduct.basePriceCents !== null
    ? calculateDiscountPreview(previewProduct.basePriceCents, draft.mode, draft.value)
    : { valid: false, discountedPriceCents: null };
  const previewMessage = previewProduct && previewProduct.basePriceCents !== null && preview.valid && preview.discountedPriceCents !== null
    ? `Preview for ${previewProduct.title}: ${formatMoney(previewProduct.basePriceCents, previewProduct.currency)} -> ${formatMoney(preview.discountedPriceCents, previewProduct.currency)}`
    : "Select a product with a valid base price and discount value to preview.";

  const hasBulkCategoryPayload = selectedProductIDs.length > 0 && selectedCategoryIDs.length > 0;
  const hasBulkDiscountPayload = selectedProductIDs.length > 0 && preview.valid;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-xl border border-surface-border bg-foreground/[0.02] px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
      >
        Open bulk tools
      </button>

      {open && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-surface-border px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold">Bulk tools</h2>
                <p className="text-sm text-foreground/65">Select products once and run category or discount operations in one action.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => setSelectedProductIDs(event.target.checked ? allProductIDs : [])}
                  />
                  Select all ({products.length})
                </label>
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
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Products ({selectedProductIDs.length} selected)</p>
                  <div className="max-h-60 space-y-2 overflow-auto rounded-xl border border-surface-border p-3">
                    {products.map((product) => (
                      <label key={product.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.03]">
                        <input
                          type="checkbox"
                          checked={selectedProductIDs.includes(product.id)}
                          onChange={(event) => setSelectedProductIDs((current) => toggleProductSelection(current, product.id, event.target.checked))}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{product.title}</span>
                          <span className="block truncate font-mono text-xs text-foreground/60">/{product.slug}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

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
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
