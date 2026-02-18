import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  applyAdminProductDiscount,
  bulkApplyAdminProductDiscount,
  bulkAssignAdminProductCategories,
  bulkRemoveAdminProductCategories,
  createAdminProduct,
  getCategories,
  getProducts,
  type Product,
  type ProductVariant,
  updateAdminProduct,
} from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { selectProductGridImage } from "@/lib/product-images";
import { applyAdminProductsState, parseAdminProductsSearchParams } from "@/lib/admin-catalog-state";
import { ProductsBulkTools } from "@/components/admin/catalog/products-bulk-tools";
import { ProductsCreateModal } from "@/components/admin/catalog/products-create-modal";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

type ProductViewData = {
  basePriceCents: number | null;
  priceLabel: string;
  stockTotal: number;
  stockState: "in_stock" | "out_of_stock" | "low_stock";
  createdLabel: string;
  imageUrl: string;
  currency: string;
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

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function cleanOptional(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function cleanIDs(values: FormDataEntryValue[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of values) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function messageHref(basePath: string, key: "notice" | "error", message: string): string {
  const path = basePath.startsWith("/") ? basePath : "/admin/catalog/products";
  const url = new URL(`http://localhost${path}`);
  url.searchParams.set(key, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/admin/catalog/products";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/admin/catalog/products")) return "/admin/catalog/products";
  return trimmed;
}

function parseDiscountPayload(formData: FormData): { mode: "price"; discount_price_cents: number } | { mode: "percent"; discount_percent: number } {
  const mode = String(formData.get("mode") ?? "percent").trim().toLowerCase();
  if (mode === "price") {
    const value = Number.parseInt(String(formData.get("discount_price_cents") ?? ""), 10);
    if (!Number.isFinite(value)) {
      throw new Error("discount_price_cents is required");
    }
    return { mode: "price", discount_price_cents: value };
  }
  const value = Number.parseFloat(String(formData.get("discount_percent") ?? ""));
  if (!Number.isFinite(value)) {
    throw new Error("discount_percent is required");
  }
  return { mode: "percent", discount_percent: value };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

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

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = parseAdminProductsSearchParams(searchParams);
  const state = { sort: params.sort, stock: params.stock };
  const notice = firstQueryValue(searchParams?.notice);
  const actionError = firstQueryValue(searchParams?.error);

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

  const currentHref = toHref({});

  const createProductAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    try {
      await createAdminProduct({
        slug: String(formData.get("slug") ?? "").trim(),
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        seo_title: cleanOptional(formData.get("seo_title")),
        seo_description: cleanOptional(formData.get("seo_description")),
      });
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Product created"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const updateProductAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productID = String(formData.get("product_id") ?? "").trim();
    if (!productID) {
      redirect(messageHref(returnTo, "error", "Missing product id"));
    }
    try {
      await updateAdminProduct(productID, {
        slug: String(formData.get("slug") ?? "").trim(),
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        seo_title: cleanOptional(formData.get("seo_title")),
        seo_description: cleanOptional(formData.get("seo_description")),
      });
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Product updated"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const assignCategoriesToSingleAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productID = String(formData.get("product_id") ?? "").trim();
    const categoryIDs = cleanIDs(formData.getAll("category_ids"));
    if (!productID || categoryIDs.length === 0) {
      redirect(messageHref(returnTo, "error", "Choose product and categories"));
    }
    try {
      await bulkAssignAdminProductCategories({ product_ids: [productID], category_ids: categoryIDs });
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Categories assigned"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const removeCategoriesFromSingleAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productID = String(formData.get("product_id") ?? "").trim();
    const categoryIDs = cleanIDs(formData.getAll("category_ids"));
    if (!productID || categoryIDs.length === 0) {
      redirect(messageHref(returnTo, "error", "Choose product and categories"));
    }
    try {
      await bulkRemoveAdminProductCategories({ product_ids: [productID], category_ids: categoryIDs });
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Categories removed"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const discountSingleProductAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productID = String(formData.get("product_id") ?? "").trim();
    if (!productID) {
      redirect(messageHref(returnTo, "error", "Missing product id"));
    }
    try {
      await applyAdminProductDiscount(productID, parseDiscountPayload(formData));
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Discount applied"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const bulkAssignCategoriesAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productIDs = cleanIDs(formData.getAll("product_ids"));
    const categoryIDs = cleanIDs(formData.getAll("category_ids"));
    if (productIDs.length === 0 || categoryIDs.length === 0) {
      redirect(messageHref(returnTo, "error", "Select products and categories"));
    }
    try {
      await bulkAssignAdminProductCategories({ product_ids: productIDs, category_ids: categoryIDs });
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Bulk category assignment complete"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const bulkRemoveCategoriesAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productIDs = cleanIDs(formData.getAll("product_ids"));
    const categoryIDs = cleanIDs(formData.getAll("category_ids"));
    if (productIDs.length === 0 || categoryIDs.length === 0) {
      redirect(messageHref(returnTo, "error", "Select products and categories"));
    }
    try {
      await bulkRemoveAdminProductCategories({ product_ids: productIDs, category_ids: categoryIDs });
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Bulk category removal complete"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const bulkDiscountAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productIDs = cleanIDs(formData.getAll("product_ids"));
    if (productIDs.length === 0) {
      redirect(messageHref(returnTo, "error", "Select products"));
    }
    try {
      await bulkApplyAdminProductDiscount({ product_ids: productIDs, ...parseDiscountPayload(formData) });
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Bulk discount applied"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-foreground/70">Create, edit, assign categories, and apply discounts with single or bulk workflows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProductsCreateModal createAction={createProductAction} returnTo={currentHref} />
          <Link
            href="/admin/catalog/categories"
            className="rounded-xl border border-surface-border bg-foreground/[0.02] px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
          >
            Manage categories
          </Link>
        </div>
      </div>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}
      {actionError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div>}
      {fetchError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}

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
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        bulkAssignAction={bulkAssignCategoriesAction}
        bulkRemoveAction={bulkRemoveCategoriesAction}
        bulkDiscountAction={bulkDiscountAction}
        returnTo={currentHref}
      />

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

        {visibleProducts.length === 0 ? (
          <div className="p-4">
            <div className="rounded-xl border border-surface-border p-8 text-center text-sm text-foreground/60">
              {fetchError ? "No products loaded." : "No products match the selected filters."}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Slug</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Stock</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => {
                  const view = toProductViewData(product);
                  return (
                    <tr key={product.id} className="border-t border-surface-border align-top">
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
                      <td className="px-3 py-3 text-foreground/75">{view.createdLabel}</td>
                      <td className="px-3 py-3 text-right">
                        <details className="inline-block rounded-lg border border-surface-border bg-background/70 p-2 text-left">
                          <summary className="cursor-pointer text-xs font-medium">Edit</summary>
                          <div className="mt-3 grid w-[min(90vw,900px)] gap-3 lg:grid-cols-3">
                            <form action={updateProductAction} className="space-y-2 rounded-lg border border-surface-border p-3">
                              <input type="hidden" name="return_to" value={currentHref} />
                              <input type="hidden" name="product_id" value={product.id} />
                              <p className="text-sm font-medium">Edit product</p>
                              <input defaultValue={product.title} name="title" required className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm" />
                              <input defaultValue={product.slug} name="slug" required className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm" />
                              <textarea defaultValue={product.description} name="description" rows={3} className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm" />
                              <input defaultValue={product.seoTitle ?? ""} name="seo_title" maxLength={120} placeholder="SEO title" className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm" />
                              <input defaultValue={product.seoDescription ?? ""} name="seo_description" maxLength={320} placeholder="SEO description" className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm" />
                              <button type="submit" className="w-full rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300">Save product</button>
                            </form>

                            <form action={assignCategoriesToSingleAction} className="space-y-2 rounded-lg border border-surface-border p-3">
                              <input type="hidden" name="return_to" value={currentHref} />
                              <input type="hidden" name="product_id" value={product.id} />
                              <p className="text-sm font-medium">Assign categories</p>
                              <select multiple name="category_ids" className="h-36 w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm">
                                {categories.map((category) => (
                                  <option key={`${product.id}-assign-${category.id}`} value={category.id}>{category.name}</option>
                                ))}
                              </select>
                              <button type="submit" className="w-full rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">Assign selected</button>
                            </form>

                            <div className="space-y-2 rounded-lg border border-surface-border p-3">
                              <form action={removeCategoriesFromSingleAction} className="space-y-2">
                                <input type="hidden" name="return_to" value={currentHref} />
                                <input type="hidden" name="product_id" value={product.id} />
                                <p className="text-sm font-medium">Remove categories</p>
                                <select multiple name="category_ids" className="h-24 w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm">
                                  {categories.map((category) => (
                                    <option key={`${product.id}-remove-${category.id}`} value={category.id}>{category.name}</option>
                                  ))}
                                </select>
                                <button type="submit" className="w-full rounded-lg border border-amber-500/35 bg-amber-500/12 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300">Remove selected</button>
                              </form>
                              <form action={discountSingleProductAction} className="space-y-2 border-t border-surface-border pt-2">
                                <input type="hidden" name="return_to" value={currentHref} />
                                <input type="hidden" name="product_id" value={product.id} />
                                <p className="text-sm font-medium">Single discount</p>
                                <select name="mode" defaultValue="percent" className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm">
                                  <option value="percent">Percent %</option>
                                  <option value="price">Static price (cents)</option>
                                </select>
                                <input name="discount_percent" defaultValue="10" type="number" step="0.01" min="0" max="100" placeholder="discount_percent" className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm" />
                                <input name="discount_price_cents" type="number" min="0" placeholder="discount_price_cents (for price mode)" className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm" />
                                <p className="text-xs text-foreground/60">Use bulk tools for instant discount preview.</p>
                                <button type="submit" className="w-full rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300">Apply discount</button>
                              </form>
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
