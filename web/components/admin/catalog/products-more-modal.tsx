"use client";

import { useState } from "react";

import type { AdminCustomOption, AdminProductCustomOptionAssignment } from "@/lib/api";

type ActionFn = (formData: FormData) => void | Promise<void>;

type Props = {
  returnTo: string;
  productID: string;
  categories: Array<{ id: string; name: string }>;
  assignments: AdminProductCustomOptionAssignment[];
  attachableOptions: AdminCustomOption[];
  assignCategoriesAction: ActionFn;
  removeCategoriesAction: ActionFn;
  discountAction: ActionFn;
  attachCustomOptionAction: ActionFn;
  detachCustomOptionAction: ActionFn;
};

export function ProductsMoreModal({
  returnTo,
  productID,
  categories,
  assignments,
  attachableOptions,
  assignCategoriesAction,
  removeCategoriesAction,
  discountAction,
  attachCustomOptionAction,
  detachCustomOptionAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const optionPickerID = `custom-option-picker-${productID}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium hover:bg-foreground/[0.05]"
      >
        More
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
              <h2 className="text-lg font-semibold">Product tools</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="grid max-h-[80vh] gap-3 overflow-auto p-4 lg:grid-cols-3">
              <form action={assignCategoriesAction} className="space-y-2 rounded-lg border border-surface-border p-3">
                <input type="hidden" name="return_to" value={returnTo} />
                <input type="hidden" name="product_id" value={productID} />
                <p className="text-sm font-medium">Assign categories</p>
                <select multiple name="category_ids" className="h-36 w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm">
                  {categories.map((category) => (
                    <option key={`${productID}-assign-${category.id}`} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="w-full rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Assign selected
                </button>
              </form>

              <div className="space-y-2 rounded-lg border border-surface-border p-3">
                <form action={removeCategoriesAction} className="space-y-2">
                  <input type="hidden" name="return_to" value={returnTo} />
                  <input type="hidden" name="product_id" value={productID} />
                  <p className="text-sm font-medium">Remove categories</p>
                  <select multiple name="category_ids" className="h-24 w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm">
                    {categories.map((category) => (
                      <option key={`${productID}-remove-${category.id}`} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="w-full rounded-lg border border-amber-500/35 bg-amber-500/12 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                    Remove selected
                  </button>
                </form>
                <form action={discountAction} className="space-y-2 border-t border-surface-border pt-2">
                  <input type="hidden" name="return_to" value={returnTo} />
                  <input type="hidden" name="product_id" value={productID} />
                  <p className="text-sm font-medium">Single discount</p>
                  <select name="mode" defaultValue="percent" className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm">
                    <option value="percent">Percent %</option>
                    <option value="price">Static price (cents)</option>
                  </select>
                  <input name="discount_percent" defaultValue="10" type="number" step="0.01" min="0" max="100" placeholder="discount_percent" className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm" />
                  <input name="discount_price_cents" type="number" min="0" placeholder="discount_price_cents (for price mode)" className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm" />
                  <p className="text-xs text-foreground/60">Use bulk tools for instant discount preview.</p>
                  <button type="submit" className="w-full rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                    Apply discount
                  </button>
                </form>
              </div>

              <div className="space-y-3 rounded-lg border border-surface-border p-3">
                <form action={attachCustomOptionAction} className="space-y-2">
                  <input type="hidden" name="return_to" value={returnTo} />
                  <input type="hidden" name="product_id" value={productID} />
                  <p className="text-sm font-medium">Customizable options</p>
                  <label className="block space-y-1 text-xs">
                    <span className="text-foreground/70">Search/select option</span>
                    <input
                      name="option_pick"
                      list={optionPickerID}
                      placeholder="Type title and pick an option"
                      className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <datalist id={optionPickerID}>
                    {attachableOptions.map((option) => (
                      <option key={`${productID}-custom-option-${option.id}`} value={`${option.title} (${option.id})`}>
                        {option.type_group} / {option.type}
                      </option>
                    ))}
                  </datalist>
                  <label className="block space-y-1 text-xs">
                    <span className="text-foreground/70">Or select multiple</span>
                    <select multiple name="option_ids" className="h-28 w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm">
                      {attachableOptions.map((option) => (
                        <option key={`${productID}-custom-option-multi-${option.id}`} value={option.id}>
                          {option.title} ({option.type_group} / {option.type})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="text-foreground/70">Sort order</span>
                    <input
                      name="sort_order"
                      type="number"
                      defaultValue="0"
                      className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <button type="submit" className="w-full rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Attach option
                  </button>
                </form>
                <div className="space-y-2 border-t border-surface-border pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/65">Assigned options</p>
                  {assignments.length === 0 ? (
                    <p className="text-xs text-foreground/60">No customizable options attached.</p>
                  ) : (
                    <ul className="space-y-2">
                      {assignments.map((assignment) => {
                        const option = assignment.option;
                        return (
                          <li key={`${assignment.product_id}-${assignment.option_id}`} className="rounded-lg border border-surface-border p-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">{option?.title || assignment.option_id}</p>
                                <p className="text-foreground/65">
                                  {option ? `${option.type_group} / ${option.type}` : "Unknown type"} | Sort {assignment.sort_order}
                                </p>
                                <p className="text-foreground/65">
                                  Required: {option?.required ? "Yes" : "No"} | Active: {option?.is_active ? "Yes" : "No"}
                                </p>
                              </div>
                              <form action={detachCustomOptionAction}>
                                <input type="hidden" name="return_to" value={returnTo} />
                                <input type="hidden" name="product_id" value={productID} />
                                <input type="hidden" name="option_id" value={assignment.option_id} />
                                <button
                                  type="submit"
                                  className="rounded-md border border-red-500/35 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-500/15 dark:text-red-300"
                                >
                                  Detach
                                </button>
                              </form>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
