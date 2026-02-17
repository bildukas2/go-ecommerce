import Link from "next/link";
import { getCategories, getProducts, type Product, type ProductVariant } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { selectProductGridImage } from "@/lib/product-images";
import { applyAdminProductsState, parseAdminProductsSearchParams } from "@/lib/admin-catalog-state";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

type ProductViewData = {
  priceLabel: string;
  stockTotal: number;
  stockState: "in_stock" | "out_of_stock" | "low_stock";
  createdLabel: string;
  imageUrl: string;
};

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
  { value: "price_asc", label: "Price low-high" },
  { value: "price_desc", label: "Price high-low" },
] as const;

const stockOptions = [
  { value: "all", label: "All stock" },
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "low_stock", label: "Low stock (<= 5)" },
] as const;

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

  return {
    priceLabel: variant ? formatMoney(variant.priceCents, variant.currency || "USD") : "No active price",
    stockTotal,
    stockState,
    createdLabel,
    imageUrl: selectProductGridImage(product.images) || "/images/noImage.png",
  };
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = parseAdminProductsSearchParams(searchParams);
  const state = { sort: params.sort, stock: params.stock };

  let categories: Awaited<ReturnType<typeof getCategories>>["items"] = [];
  let products: Awaited<ReturnType<typeof getProducts>>["items"] = [];
  let fetchError: string | null = null;

  try {
    const [categoriesResponse, productsResponse] = await Promise.all([
      getCategories(),
      getProducts({
        page: params.page,
        limit: params.limit,
        category: params.category || undefined,
      }),
    ]);
    categories = categoriesResponse.items;
    products = productsResponse.items;
  } catch {
    fetchError = "Failed to load products. Please retry.";
  }

  const visibleProducts = applyAdminProductsState(products, state);
  const hasPrev = params.page > 1;
  const hasNext = products.length === params.limit;

  const toHref = (patch: Partial<typeof params>): string => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();
    query.set("page", String(next.page));
    query.set("limit", String(next.limit));
    if (next.category) query.set("category", next.category);
    if (next.sort !== "newest") query.set("sort", next.sort);
    if (next.stock !== "all") query.set("stock", next.stock);
    return `/admin/catalog/products?${query.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-foreground/70">Visual catalog list with sorting and filters.</p>
        </div>
        <Link
          href="/admin/catalog/categories"
          className="rounded-xl border border-surface-border bg-foreground/[0.02] px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
        >
          Browse categories
        </Link>
      </div>

      <section className="glass rounded-2xl border p-4">
        <form method="get" action="/admin/catalog/products" className="grid gap-3 md:grid-cols-5">
          <input type="hidden" name="page" value="1" />
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">Category</span>
            <select
              name="category"
              defaultValue={params.category}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">Sort</span>
            <select
              name="sort"
              defaultValue={params.sort}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">Stock</span>
            <select
              name="stock"
              defaultValue={params.stock}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            >
              {stockOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">Per page</span>
            <select
              name="limit"
              defaultValue={String(params.limit)}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>

          <button
            type="submit"
            className="mt-6 rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
          >
            Apply
          </button>
        </form>
      </section>

      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      <section className="glass rounded-2xl border shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 text-sm">
          <span className="text-foreground/75">
            Showing {visibleProducts.length} item{visibleProducts.length === 1 ? "" : "s"} on page {params.page}
          </span>
          <div className="flex items-center gap-2">
            {hasPrev ? (
              <Link href={toHref({ page: params.page - 1 })} className="rounded-lg border border-surface-border px-3 py-1.5 hover:bg-foreground/[0.05]">
                Prev
              </Link>
            ) : (
              <span className="rounded-lg border border-surface-border px-3 py-1.5 text-foreground/40">Prev</span>
            )}
            {hasNext ? (
              <Link href={toHref({ page: params.page + 1 })} className="rounded-lg border border-surface-border px-3 py-1.5 hover:bg-foreground/[0.05]">
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-surface-border px-3 py-1.5 text-foreground/40">Next</span>
            )}
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="text-left text-foreground/70">
              <tr className="border-b border-surface-border">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const view = toProductViewData(product);
                return (
                  <tr key={product.id} className="border-b border-surface-border/80 hover:bg-foreground/[0.03]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="image-default-bg size-14 overflow-hidden rounded-xl border border-surface-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={view.imageUrl} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                        <div>
                          <p className="font-medium">{product.title}</p>
                          <p className="font-mono text-xs text-foreground/60">/{product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground/75">{params.category || "All"}</td>
                    <td className="px-4 py-3 font-medium">{view.priceLabel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-xs font-medium",
                          view.stockState === "out_of_stock"
                            ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                            : view.stockState === "low_stock"
                              ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                              : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
                        ].join(" ")}
                      >
                        {view.stockTotal} in stock
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/75">{view.createdLabel}</td>
                  </tr>
                );
              })}
              {visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-foreground/60">
                    {fetchError ? "No products loaded." : "No products match the selected filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {visibleProducts.map((product) => {
            const view = toProductViewData(product);
            return (
              <article key={product.id} className="rounded-xl border border-surface-border bg-foreground/[0.02] p-3">
                <div className="flex gap-3">
                  <div className="image-default-bg size-16 shrink-0 overflow-hidden rounded-lg border border-surface-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={view.imageUrl} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-semibold">{product.title}</p>
                    <p className="truncate font-mono text-xs text-foreground/60">/{product.slug}</p>
                    <p className="text-sm font-medium">{view.priceLabel}</p>
                    <p className="text-xs text-foreground/65">{view.stockTotal} in stock</p>
                  </div>
                </div>
              </article>
            );
          })}
          {visibleProducts.length === 0 && (
            <div className="rounded-xl border border-surface-border p-8 text-center text-sm text-foreground/60">
              {fetchError ? "No products loaded." : "No products match the selected filters."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
