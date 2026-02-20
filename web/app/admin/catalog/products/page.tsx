import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  applyAdminProductDiscount,
  attachAdminProductCustomOption,
  bulkApplyAdminProductDiscount,
  bulkAssignAdminProductCategories,
  bulkRemoveAdminProductCategories,
  createAdminProductVariant,
  deleteAdminProduct,
  createAdminProduct,
  detachAdminProductCustomOption,
  getAdminCustomOptions,
  getAdminProductCustomOptions,
  getCategories,
  getProducts,
  setAdminProductCategories,
  updateAdminProduct,
  type AdminProductCustomOptionAssignment,
} from "@/lib/api";
import {
  applyAdminProductsState,
  attachCustomOptionsIgnoringConflicts,
  parseAdminProductsSearchParams,
} from "@/lib/admin-catalog-state";
import { ProductsTableManager } from "@/components/admin/catalog/products-table-manager";
import { ProductsCreateModal } from "@/components/admin/catalog/products-create-modal";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams?: Promise<SearchParams> };

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

function parseMoneyToCents(raw: string, field: string): number {
  const normalized = raw.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${field} must be a valid non-negative number`);
  }
  return Math.round(parsed * 100);
}

function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function parseSortOrderInput(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string") return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function parseOptionPickerValue(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/\(([^()]+)\)\s*$/);
  if (match?.[1]) return match[1];
  return trimmed;
}

function parseOptionIDs(formData: FormData): string[] {
  const selected = cleanIDs(formData.getAll("option_ids"));
  if (selected.length > 0) {
    return selected;
  }
  const single = parseOptionPickerValue(formData.get("option_pick"));
  return single ? [single] : [];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const params = parseAdminProductsSearchParams(resolvedSearchParams);
  const state = { sort: params.sort, stock: params.stock };
  const notice = firstQueryValue(resolvedSearchParams?.notice);
  const actionError = firstQueryValue(resolvedSearchParams?.error);

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
      const created = await createAdminProduct({
        slug: String(formData.get("slug") ?? "").trim(),
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        status: String(formData.get("status") ?? "published").trim().toLowerCase(),
        tags: parseTags(String(formData.get("tags") ?? "")),
        seo_title: cleanOptional(formData.get("seo_title")),
        seo_description: cleanOptional(formData.get("seo_description")),
      });
      const stock = Number.parseInt(String(formData.get("stock") ?? ""), 10);
      if (!Number.isFinite(stock) || stock < 0) {
        throw new Error("stock must be a valid non-negative integer");
      }
      const basePriceCents = parseMoneyToCents(String(formData.get("base_price") ?? ""), "base_price");
      await createAdminProductVariant(created.id, {
        sku: String(formData.get("sku") ?? "").trim(),
        price_cents: basePriceCents,
        stock,
        currency: "USD",
      });

      const categoryIDs = cleanIDs(formData.getAll("category_ids"));
      if (categoryIDs.length > 0) {
        await bulkAssignAdminProductCategories({ product_ids: [created.id], category_ids: categoryIDs });
      }
      const optionIDs = parseOptionIDs(formData);
      if (optionIDs.length > 0) {
        await attachCustomOptionsIgnoringConflicts({
          productIDs: [created.id],
          optionIDs,
          sortOrder: parseSortOrderInput(formData.get("sort_order")),
          attach: attachAdminProductCustomOption,
        });
      }

      const discountType = String(formData.get("discount_type") ?? "none").trim().toLowerCase();
      const discountRaw = String(formData.get("discount_value") ?? "").trim();
      if (discountType !== "none" && discountRaw) {
        if (discountType === "percent") {
          const percent = Number.parseFloat(discountRaw);
          if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
            throw new Error("discount percent must be between 0 and 100");
          }
          await applyAdminProductDiscount(created.id, { mode: "percent", discount_percent: percent });
        } else if (discountType === "flat") {
          const flatCents = parseMoneyToCents(discountRaw, "discount_value");
          if (flatCents <= 0 || flatCents >= basePriceCents) {
            throw new Error("flat discount must be greater than 0 and less than base price");
          }
          await applyAdminProductDiscount(created.id, { mode: "price", discount_price_cents: basePriceCents - flatCents });
        }
      }
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
        status: String(formData.get("status") ?? "published").trim().toLowerCase(),
        tags: parseTags(String(formData.get("tags") ?? "")),
        seo_title: cleanOptional(formData.get("seo_title")),
        seo_description: cleanOptional(formData.get("seo_description")),
      });
      const categoryIDs = cleanIDs(formData.getAll("category_ids"));
      if (categoryIDs.length > 0) {
        await setAdminProductCategories(productID, categoryIDs);
      }
      const optionIDs = parseOptionIDs(formData);
      if (optionIDs.length > 0) {
        await attachCustomOptionsIgnoringConflicts({
          productIDs: [productID],
          optionIDs,
          sortOrder: parseSortOrderInput(formData.get("sort_order")),
          attach: attachAdminProductCustomOption,
        });
      }

      const discountType = String(formData.get("discount_type") ?? "none").trim().toLowerCase();
      const discountRaw = String(formData.get("discount_value") ?? "").trim();
      if (discountType !== "none" && discountRaw) {
        if (discountType === "percent") {
          const percent = Number.parseFloat(discountRaw);
          if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
            throw new Error("discount percent must be between 0 and 100");
          }
          await applyAdminProductDiscount(productID, { mode: "percent", discount_percent: percent });
        } else if (discountType === "flat") {
          const basePriceCents = parseMoneyToCents(String(formData.get("base_price") ?? ""), "base_price");
          const flatCents = parseMoneyToCents(discountRaw, "discount_value");
          if (flatCents <= 0 || flatCents >= basePriceCents) {
            throw new Error("flat discount must be greater than 0 and less than base price");
          }
          await applyAdminProductDiscount(productID, {
            mode: "price",
            discount_price_cents: basePriceCents - flatCents,
          });
        }
      }
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Product updated"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const deleteProductAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productID = String(formData.get("product_id") ?? "").trim();
    if (!productID) {
      redirect(messageHref(returnTo, "error", "Missing product id"));
    }
    try {
      await deleteAdminProduct(productID);
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Product deleted"));
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

  const attachCustomOptionAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productID = String(formData.get("product_id") ?? "").trim();
    if (!productID) {
      redirect(messageHref(returnTo, "error", "Missing product id"));
    }
    const optionIDs = parseOptionIDs(formData);
    if (optionIDs.length === 0) {
      redirect(messageHref(returnTo, "error", "Choose at least one customizable option"));
    }
    try {
      const result = await attachCustomOptionsIgnoringConflicts({
        productIDs: [productID],
        optionIDs,
        sortOrder: parseSortOrderInput(formData.get("sort_order")),
        attach: attachAdminProductCustomOption,
      });
      revalidatePath("/admin/catalog/products");
      const notice =
        result.ignored > 0
          ? `${result.attached} attached, ${result.ignored} already assigned`
          : optionIDs.length === 1
            ? "Customizable option attached"
            : `${optionIDs.length} customizable options attached`;
      redirect(
        messageHref(
          returnTo,
          "notice",
          notice,
        ),
      );
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const detachCustomOptionAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productID = String(formData.get("product_id") ?? "").trim();
    const optionID = String(formData.get("option_id") ?? "").trim();
    if (!productID || !optionID) {
      redirect(messageHref(returnTo, "error", "Missing assignment data"));
    }
    try {
      await detachAdminProductCustomOption(productID, optionID);
      revalidatePath("/admin/catalog/products");
      redirect(messageHref(returnTo, "notice", "Customizable option detached"));
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

  const bulkAttachCustomOptionsAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const productIDs = cleanIDs(formData.getAll("product_ids"));
    const optionIDs = parseOptionIDs(formData);
    if (productIDs.length === 0 || optionIDs.length === 0) {
      redirect(messageHref(returnTo, "error", "Select products and customizable options"));
    }
    try {
      const result = await attachCustomOptionsIgnoringConflicts({
        productIDs,
        optionIDs,
        sortOrder: parseSortOrderInput(formData.get("sort_order")),
        attach: attachAdminProductCustomOption,
      });
      revalidatePath("/admin/catalog/products");
      const message =
        result.ignored > 0
          ? `Bulk custom-option assignment complete (${result.attached} attached, ${result.ignored} already assigned)`
          : "Bulk custom-option assignment complete";
      redirect(messageHref(returnTo, "notice", message));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  let categories: Awaited<ReturnType<typeof getCategories>>["items"] = [];
  let products: Awaited<ReturnType<typeof getProducts>>["items"] = [];
  let availableCustomOptions: Awaited<ReturnType<typeof getAdminCustomOptions>>["items"] = [];
  const assignmentsByProductID = new Map<string, AdminProductCustomOptionAssignment[]>();
  const customOptionsByID = new Map<string, Awaited<ReturnType<typeof getAdminCustomOptions>>["items"][number]>();
  let fetchError: string | null = null;
  let customOptionsFetchError: string | null = null;

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
  if (!fetchError) {
    try {
      const optionsResponse = await getAdminCustomOptions();
      availableCustomOptions = optionsResponse.items;
    } catch {
      try {
        const retryResponse = await getAdminCustomOptions();
        availableCustomOptions = retryResponse.items;
      } catch {
        customOptionsFetchError = "Customizable options section is temporarily unavailable.";
      }
    }

    for (const option of availableCustomOptions) {
      customOptionsByID.set(option.id, option);
    }

    if (visibleProducts.length > 0) {
      const assignmentsResults = await Promise.allSettled(
        visibleProducts.map(async (product) => {
          const response = await getAdminProductCustomOptions(product.id);
          return [product.id, response.items] as const;
        }),
      );

      for (const result of assignmentsResults) {
        if (result.status === "fulfilled") {
          const [productID, items] = result.value;
          assignmentsByProductID.set(productID, items);
          for (const assignment of items) {
            if (assignment.option?.id) {
              customOptionsByID.set(assignment.option.id, assignment.option);
            }
          }
        }
      }
    }

    if (availableCustomOptions.length === 0 && customOptionsByID.size > 0) {
      availableCustomOptions = Array.from(customOptionsByID.values());
    }

    if (availableCustomOptions.length > 0) {
      customOptionsFetchError = null;
    }
  }

  const hasPrev = params.page > 1;
  const hasNext = products.length === params.limit;

  const assignmentsByProductIDObj: Record<string, AdminProductCustomOptionAssignment[]> = {};
  for (const [productID, items] of assignmentsByProductID) {
    assignmentsByProductIDObj[productID] = items;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-foreground/70">Create, edit, assign categories, and apply discounts with single or bulk workflows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProductsCreateModal
            createAction={createProductAction}
            returnTo={currentHref}
            categories={categories.map((category) => ({ id: category.id, name: category.name }))}
            customOptions={availableCustomOptions}
          />
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
      {customOptionsFetchError && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{customOptionsFetchError}</div>}

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
        <ProductsTableManager
          visibleProducts={visibleProducts}
          categories={categories.map((category) => ({ id: category.id, name: category.name }))}
          assignmentsByProductID={assignmentsByProductIDObj}
          availableCustomOptions={availableCustomOptions}
          currentHref={currentHref}
          updateProductAction={updateProductAction}
          deleteProductAction={deleteProductAction}
          assignCategoriesToSingleAction={assignCategoriesToSingleAction}
          removeCategoriesFromSingleAction={removeCategoriesFromSingleAction}
          discountSingleProductAction={discountSingleProductAction}
          attachCustomOptionAction={attachCustomOptionAction}
          detachCustomOptionAction={detachCustomOptionAction}
          bulkAssignCategoriesAction={bulkAssignCategoriesAction}
          bulkRemoveCategoriesAction={bulkRemoveCategoriesAction}
          bulkDiscountAction={bulkDiscountAction}
          bulkAttachCustomOptionsAction={bulkAttachCustomOptionsAction}
        />
      )}
    </div>
  );
}
