"use client";

import { useState } from "react";
import { 
  isEveryProductSelected, 
  toggleProductSelection, 
  normalizeSelectedProductIDs 
} from "@/lib/admin-catalog-state";
import { ProductsBulkTools } from "./products-bulk-tools";
import { ProductsEditModal } from "./products-edit-modal";
import { ProductsDeleteButton } from "./products-delete-button";
import { ProductsMoreModal } from "./products-more-modal";
import { formatMoney } from "@/lib/money";
import { selectProductGridImage } from "@/lib/product-images";
import type { 
  AdminProductCustomOptionAssignment, 
  Product, 
  ProductVariant,
  AdminCustomOption
} from "@/lib/api";

type CategoryOption = {
  id: string;
  name: string;
};

type ActionFn = (formData: FormData) => void | Promise<void>;

type Props = {
  visibleProducts: Product[];
  categories: CategoryOption[];
  assignmentsByProductID: Record<string, AdminProductCustomOptionAssignment[]>;
  availableCustomOptions: AdminCustomOption[];
  currentHref: string;
  updateProductAction: ActionFn;
  deleteProductAction: ActionFn;
  assignCategoriesToSingleAction: ActionFn;
  removeCategoriesFromSingleAction: ActionFn;
  discountSingleProductAction: ActionFn;
  attachCustomOptionAction: ActionFn;
  detachCustomOptionAction: ActionFn;
  bulkAssignCategoriesAction: ActionFn;
  bulkRemoveCategoriesAction: ActionFn;
  bulkDiscountAction: ActionFn;
  bulkAttachCustomOptionsAction: ActionFn;
};

type ProductViewData = {
  basePriceCents: number | null;
  priceLabel: string;
  stockTotal: number;
  stockState: "in_stock" | "out_of_stock" | "low_stock";
  createdLabel: string;
  imageUrl: string;
  currency: string;
};

function pickDisplayVariant(product: Product): ProductVariant | null {
  const inStockVariant = product.variants.find((variant) => variant.stock > 0);
  return inStockVariant ?? product.variants[0] ?? null;
}

function totalStock(product: Product): number {
  return product.variants.reduce((sum, variant) => sum + Math.max(0, variant.stock), 0);
}

function toProductViewData(product: Product): ProductViewData {
  const variant = pickDisplayVariant(product);
  const stockTotal = totalStock(product);
  const stockState = stockTotal <= 0 ? "out_of_stock" : stockTotal <= 5 ? "low_stock" : "in_stock";
  const createdTimestamp = Date.parse(product.createdAt ?? "");
  const createdLabel = Number.isFinite(createdTimestamp)
    ? new Date(createdTimestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Unknown";

  const basePriceCents = variant?.compareAtPriceCents ?? variant?.priceCents ?? null;
  const currency = variant?.currency || "USD";

  return {
    basePriceCents,
    priceLabel: variant ? formatMoney(variant.priceCents, currency) : "No active price",
    stockTotal,
    stockState,
    createdLabel,
    imageUrl: selectProductGridImage(product.images) || "/images/noImage.png",
    currency,
  };
}

export function ProductsTableManager({
  visibleProducts,
  categories,
  assignmentsByProductID,
  availableCustomOptions,
  currentHref,
  updateProductAction,
  deleteProductAction,
  assignCategoriesToSingleAction,
  removeCategoriesFromSingleAction,
  discountSingleProductAction,
  attachCustomOptionAction,
  detachCustomOptionAction,
  bulkAssignCategoriesAction,
  bulkRemoveCategoriesAction,
  bulkDiscountAction,
  bulkAttachCustomOptionsAction,
}: Props) {
  const [selectedProductIDs, setSelectedProductIDs] = useState<string[]>([]);

  const productIDs = visibleProducts.map((p) => p.id);
  const isAllSelected = isEveryProductSelected(productIDs, selectedProductIDs);

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedProductIDs([]);
    } else {
      setSelectedProductIDs(normalizeSelectedProductIDs(productIDs));
    }
  };

  const handleToggleProduct = (productID: string, checked: boolean) => {
    setSelectedProductIDs((prev) => toggleProductSelection(prev, productID, checked));
  };

  return (
    <div className="space-y-6">
      <ProductsBulkTools
        products={visibleProducts.map((product) => {
          const view = toProductViewData(product);
          return {
            id: product.id,
            title: product.title,
            slug: product.slug,
            basePriceCents: view.basePriceCents,
            currency: view.currency,
          };
        })}
        categories={categories}
        customOptions={availableCustomOptions}
        selectedProductIDs={selectedProductIDs}
        bulkAssignAction={bulkAssignCategoriesAction}
        bulkRemoveAction={bulkRemoveCategoriesAction}
        bulkDiscountAction={bulkDiscountAction}
        bulkAttachCustomOptionsAction={bulkAttachCustomOptionsAction}
        returnTo={currentHref}
      />

      <section className="glass rounded-2xl border shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-surface-border bg-background text-blue-600"
                    checked={isAllSelected}
                    onChange={handleToggleAll}
                  />
                </th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const view = toProductViewData(product);
                const displayVariant = pickDisplayVariant(product);
                const assignments = assignmentsByProductID[product.id] ?? [];
                const assignedOptionIDs = new Set(assignments.map((assignment) => assignment.option_id));
                const attachableOptions = availableCustomOptions.filter((option) => !assignedOptionIDs.has(option.id));
                const isSelected = selectedProductIDs.includes(product.id);

                return (
                  <tr key={product.id} className="border-t border-surface-border align-top">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-surface-border bg-background text-blue-600"
                        checked={isSelected}
                        onChange={(e) => handleToggleProduct(product.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="image-default-bg size-14 shrink-0 overflow-hidden rounded-lg border border-surface-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={view.imageUrl} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                        <p className="max-w-[260px] truncate font-semibold">{product.title}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-foreground/60">/{product.slug}</td>
                    <td className="px-3 py-3">{view.priceLabel}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          view.stockState === "in_stock"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : view.stockState === "low_stock"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-red-500/15 text-red-700 dark:text-red-300"
                        }`}
                      >
                        {view.stockTotal}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.status === "inactive"
                          ? "bg-slate-500/20 text-slate-700 dark:text-slate-300"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      }`}>
                        {product.status || "published"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-foreground/75">{view.createdLabel}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <ProductsEditModal
                          updateAction={updateProductAction}
                          returnTo={currentHref}
                          categories={categories}
                          customOptions={availableCustomOptions}
                          assignments={assignments}
                          product={{
                            id: product.id,
                            title: product.title,
                            slug: product.slug,
                            description: product.description,
                            status: product.status || "published",
                            tags: product.tags || [],
                            seoTitle: product.seoTitle ?? "",
                            seoDescription: product.seoDescription ?? "",
                            sku: displayVariant?.sku || "",
                            stock: displayVariant?.stock ?? 0,
                            basePrice: displayVariant && Number.isFinite(displayVariant.priceCents)
                              ? (displayVariant.priceCents / 100).toFixed(2)
                              : "0.00",
                          }}
                        />
                        <ProductsMoreModal
                          returnTo={currentHref}
                          productID={product.id}
                          categories={categories}
                          assignments={assignments}
                          attachableOptions={attachableOptions}
                          assignCategoriesAction={assignCategoriesToSingleAction}
                          removeCategoriesAction={removeCategoriesFromSingleAction}
                          discountAction={discountSingleProductAction}
                          attachCustomOptionAction={attachCustomOptionAction}
                          detachCustomOptionAction={detachCustomOptionAction}
                        />
                        <ProductsDeleteButton
                          deleteAction={deleteProductAction}
                          productID={product.id}
                          productTitle={product.title}
                          returnTo={currentHref}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
