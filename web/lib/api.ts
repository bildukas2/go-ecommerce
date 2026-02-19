import { API_URL } from "./config";
import { parseCheckoutResponse } from "./checkout-state";

function apiJoin(path: string): string {
  const base = new URL(API_URL);
  const clean = path.replace(/^\/+/, "");
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL(clean, base).toString();
}

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  tags: string[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  variants: ProductVariant[];
  images: ProductImage[];
  customOptions?: AdminCustomOption[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProductVariant = {
  id: string;
  sku: string;
  priceCents: number;
  compareAtPriceCents?: number | null;
  currency: string;
  stock: number;
  attributes: Record<string, string | number | boolean | null>;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string;
  sort: number;
  isDefault: boolean;
};

export type AdminCustomOptionValue = {
  id: string;
  option_id: string;
  title: string;
  sku?: string | null;
  sort_order: number;
  price_type: "fixed" | "percent";
  price_value: number;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AdminCustomOption = {
  id: string;
  store_id?: string | null;
  code: string;
  title: string;
  type_group: "text" | "file" | "select" | "date";
  type: "field" | "area" | "file" | "dropdown" | "radio" | "checkbox" | "multiple" | "date" | "datetime" | "time";
  required: boolean;
  sort_order: number;
  price_type?: "fixed" | "percent" | null;
  price_value?: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  values: AdminCustomOptionValue[];
};

export type AdminProductCustomOptionAssignment = {
  product_id: string;
  option_id: string;
  sort_order: number;
  option?: AdminCustomOption | null;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  parentId?: string | null;
  defaultImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type AdminCategory = Category & {
  product_count: number;
};

export type AdminDeleteCategoryResult = {
  deleted_category_id: string;
  deleted_category_slug: string;
  affected_products: number;
  reassigned_products: number;
  fallback_category: string;
};

export type ProductListResponse = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (typeof value !== "object" || value === null) return {};
  return value as UnknownRecord;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  return false;
}

function normalizeAttributes(value: unknown): ProductVariant["attributes"] {
  const input = asRecord(value);
  const out: ProductVariant["attributes"] = {};
  for (const [key, raw] of Object.entries(input)) {
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" || raw === null) {
      out[key] = raw;
    } else {
      out[key] = String(raw);
    }
  }
  return out;
}

function normalizeVariant(raw: unknown): ProductVariant | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;

  return {
    id,
    sku: asString(obj.sku),
    priceCents: asNumber(obj.priceCents ?? obj.price_cents),
    compareAtPriceCents:
      obj.compareAtPriceCents === null || obj.compare_at_price_cents === null
        ? null
        : (obj.compareAtPriceCents ?? obj.compare_at_price_cents) === undefined
          ? null
          : asNumber(obj.compareAtPriceCents ?? obj.compare_at_price_cents),
    currency: asString(obj.currency),
    stock: asNumber(obj.stock),
    attributes: normalizeAttributes(obj.attributes ?? obj.attributes_json),
  };
}

function normalizeImage(raw: unknown): ProductImage | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;
  return {
    id,
    url: asString(obj.url),
    alt: asString(obj.alt),
    sort: asNumber(obj.sort),
    isDefault: asBoolean(obj.isDefault ?? obj.is_default),
  };
}

function normalizeCustomOptionValue(raw: unknown): AdminCustomOptionValue | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;

  const priceType = asString(obj.price_type).toLowerCase();
  if (priceType !== "fixed" && priceType !== "percent") return null;

  return {
    id,
    option_id: asString(obj.option_id),
    title: asString(obj.title),
    sku: asNullableString(obj.sku),
    sort_order: asNumber(obj.sort_order),
    price_type: priceType,
    price_value: asNumber(obj.price_value),
    is_default: asBoolean(obj.is_default),
    created_at: asString(obj.created_at) || undefined,
    updated_at: asString(obj.updated_at) || undefined,
  };
}

function normalizeCustomOption(raw: unknown): AdminCustomOption | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;

  const typeGroup = asString(obj.type_group).toLowerCase();
  if (!["text", "file", "select", "date"].includes(typeGroup)) return null;

  const optionType = asString(obj.type).toLowerCase();
  if (!["field", "area", "file", "dropdown", "radio", "checkbox", "multiple", "date", "datetime", "time"].includes(optionType)) {
    return null;
  }

  const rawPriceType = asNullableString(obj.price_type);
  let priceType: AdminCustomOption["price_type"] = null;
  if (rawPriceType) {
    const normalized = rawPriceType.toLowerCase();
    if (normalized !== "fixed" && normalized !== "percent") return null;
    priceType = normalized;
  }

  const valuesRaw = Array.isArray(obj.values) ? obj.values : [];
  return {
    id,
    store_id: asNullableString(obj.store_id),
    code: asString(obj.code),
    title: asString(obj.title),
    type_group: typeGroup as AdminCustomOption["type_group"],
    type: optionType as AdminCustomOption["type"],
    required: asBoolean(obj.required),
    sort_order: asNumber(obj.sort_order),
    price_type: priceType,
    price_value:
      obj.price_value === null || obj.price_value === undefined
        ? null
        : asNumber(obj.price_value),
    is_active: asBoolean(obj.is_active),
    created_at: asString(obj.created_at) || undefined,
    updated_at: asString(obj.updated_at) || undefined,
    values: valuesRaw.map(normalizeCustomOptionValue).filter((item): item is AdminCustomOptionValue => item !== null),
  };
}

function normalizeProductCustomOptionAssignment(raw: unknown): AdminProductCustomOptionAssignment | null {
  const obj = asRecord(raw);
  const productID = asString(obj.product_id);
  const optionID = asString(obj.option_id);
  if (!productID || !optionID) return null;

  const optionRaw = obj.option;
  const option = optionRaw === undefined || optionRaw === null ? null : normalizeCustomOption(optionRaw);
  return {
    product_id: productID,
    option_id: optionID,
    sort_order: asNumber(obj.sort_order),
    option,
  };
}

function normalizeProduct(raw: unknown): Product {
  const obj = asRecord(raw);
  const variantsRaw = Array.isArray(obj.variants) ? obj.variants : [];
  const imagesRaw = Array.isArray(obj.images) ? obj.images : [];
  const customOptionsMaybe = obj.customOptions ?? obj.custom_options;
  const customOptionsRaw: unknown[] = Array.isArray(customOptionsMaybe) ? customOptionsMaybe : [];

  return {
    id: asString(obj.id),
    slug: asString(obj.slug),
    title: asString(obj.title),
    description: asString(obj.description),
    status: asString(obj.status) || "published",
    tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === "string") : [],
    seoTitle: asNullableString(obj.seoTitle ?? obj.seo_title),
    seoDescription: asNullableString(obj.seoDescription ?? obj.seo_description),
    images: imagesRaw.map(normalizeImage).filter((img): img is ProductImage => img !== null),
    variants: variantsRaw.map(normalizeVariant).filter((variant): variant is ProductVariant => variant !== null),
    customOptions: customOptionsRaw
      .map(normalizeCustomOption)
      .filter((option): option is AdminCustomOption => option !== null),
    createdAt: asString(obj.createdAt ?? obj.created_at) || undefined,
    updatedAt: asString(obj.updatedAt ?? obj.updated_at) || undefined,
  };
}

function normalizeCategory(raw: unknown): Category | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  const slug = asString(obj.slug);
  const name = asString(obj.name);
  if (!id || !slug || !name) return null;

  return {
    id,
    slug,
    name,
    description: asString(obj.description),
    parentId: asNullableString(obj.parentId ?? obj.parent_id),
    defaultImageUrl: asNullableString(obj.defaultImageUrl ?? obj.default_image_url),
    seoTitle: asNullableString(obj.seoTitle ?? obj.seo_title),
    seoDescription: asNullableString(obj.seoDescription ?? obj.seo_description),
  };
}

function normalizeAdminCategory(raw: unknown): AdminCategory | null {
  const base = normalizeCategory(raw);
  if (!base) return null;
  const obj = asRecord(raw);
  return {
    ...base,
    product_count: asNumber(obj.product_count),
  };
}

export async function getProducts(params: { page?: number; limit?: number; category?: string } = {}): Promise<ProductListResponse> {
  const url = new URL(apiJoin("products"));
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.category) url.searchParams.set("category", params.category);

  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  const payload = await res.json() as Partial<ProductListResponse>;
  return {
    items: Array.isArray(payload.items) ? payload.items.map(normalizeProduct) : [],
    total: asNumber(payload.total),
    page: asNumber(payload.page) || 1,
    limit: asNumber(payload.limit) || 20,
  };
}

export async function getProduct(slug: string): Promise<Product> {
  const url = new URL(apiJoin(`products/${encodeURIComponent(slug)}`));
  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Failed to fetch product: ${res.status}`);
  const payload = await res.json() as unknown;
  return normalizeProduct(payload);
}

export async function getCategories(): Promise<{ items: Category[] }> {
  const url = new URL(apiJoin("categories"));
  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (res.status === 404) {
    return { items: [] };
  }
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  const payload = await res.json() as unknown;
  const obj = asRecord(payload);
  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
  return {
    items: itemsRaw.map(normalizeCategory).filter((category): category is Category => category !== null),
  };
}

export async function getAdminCategories(): Promise<{ items: AdminCategory[] }> {
  const url = new URL(apiJoin("admin/catalog/categories"));
  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch admin categories: ${res.status}`);
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw.map(normalizeAdminCategory).filter((item): item is AdminCategory => item !== null),
  };
}

export type CartItem = {
  ID: string;
  CartID: string;
  ProductVariantID: string;
  UnitPriceCents: number;
  Currency: string;
  Quantity: number;
  ProductTitle: string;
  ImageURL: string;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type Totals = {
  SubtotalCents: number;
  Currency: string;
  ItemCount: number;
};

export type Cart = {
  ID: string;
  Items: CartItem[];
  Totals: Totals;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export async function ensureCart(): Promise<Cart> {
  const url = new URL(apiJoin("cart"));
  const res = await fetch(url.toString(), {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to initialize cart: ${res.status}`);
  return res.json();
}

export async function getCart(): Promise<Cart> {
  const url = new URL(apiJoin("cart"));
  const res = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch cart: ${res.status}`);
  return res.json();
}

export async function addCartItem(variantId: string, quantity: number): Promise<Cart> {
  const url = new URL(apiJoin("cart/items"));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ variant_id: variantId, quantity }),
  });
  if (!res.ok) throw new Error(`Failed to add item: ${res.status}`);
  return res.json();
}

export async function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
  const url = new URL(apiJoin(`cart/items/${encodeURIComponent(itemId)}`));
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ quantity }),
  });
  if (!res.ok) throw new Error(`Failed to update item: ${res.status}`);
  return res.json();
}

export async function removeCartItem(itemId: string): Promise<Cart> {
  const url = new URL(apiJoin(`cart/items/${encodeURIComponent(itemId)}`));
  const res = await fetch(url.toString(), { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(`Failed to remove item: ${res.status}`);
  return res.json();
}

export async function checkout(): Promise<{ order_id: string; checkout_url: string; status: string }> {
  const url = new URL(apiJoin("checkout"));
  const res = await fetch(url.toString(), { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`Failed to checkout: ${res.status}`);
  const payload: unknown = await res.json();
  return parseCheckoutResponse(payload);
}

// Admin API (server-side only)
export type AdminOrderSummary = {
  id: string;
  number: string;
  status: string;
  currency: string;
  total_cents: number;
  created_at: string;
};

export type DashboardMetrics = {
  total_orders: number;
  pending_payment: number;
  paid: number;
  cancelled: number;
};

export type DashboardRecentOrder = {
  id: string;
  number: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
};

export type DashboardResponse = {
  metrics: DashboardMetrics;
  recent_orders: DashboardRecentOrder[];
};

export type AdminOrderDetailItem = {
  ID: string;
  OrderID: string;
  ProductVariantID: string;
  UnitPriceCents: number;
  Currency: string;
  Quantity: number;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type AdminOrderDetail = {
  ID: string;
  Number: string;
  Status: string;
  Currency: string;
  SubtotalCents: number;
  ShippingCents: number;
  TaxCents: number;
  TotalCents: number;
  CreatedAt?: string;
  UpdatedAt?: string;
  Items: AdminOrderDetailItem[];
};

function adminAuthHeader(): string {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) throw new Error("Missing ADMIN_USER/ADMIN_PASS on server");
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return `Basic ${token}`;
}

export async function getAdminOrders(params: { page?: number; limit?: number } = {}): Promise<{ items: AdminOrderSummary[]; page: number; limit: number; }> {
  const url = new URL(apiJoin("admin/orders"));
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
  return res.json();
}

export async function getDashboard(): Promise<DashboardResponse> {
  const url = new URL(apiJoin("admin/dashboard"));
  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch dashboard: ${res.status}`);
  return res.json();
}

export async function getAdminOrder(id: string): Promise<AdminOrderDetail> {
  const url = new URL(apiJoin(`admin/orders/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch order: ${res.status}`);
  return res.json();
}

type AdminCatalogRequestMethod = "POST" | "PATCH" | "PUT";

type AdminCatalogRequestOptions = {
  path: string;
  method: AdminCatalogRequestMethod;
  body: unknown;
};

async function adminCatalogRequest<T>({ path, method, body }: AdminCatalogRequestOptions): Promise<T> {
  const url = new URL(apiJoin(path));
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: adminAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `Admin catalog request failed: ${res.status}`;
    try {
      const payload = asRecord(await res.json());
      const errorMessage = asString(payload.error);
      if (errorMessage) detail = `${detail} (${errorMessage})`;
    } catch {}
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export type AdminMediaAsset = {
  id: string;
  url: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  alt: string;
  source_type: string;
  source_url?: string | null;
  created_at: string;
};

export type AdminMediaListResponse = {
  items: AdminMediaAsset[];
  limit: number;
  offset: number;
};

function normalizeAdminMediaAsset(raw: unknown): AdminMediaAsset | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  const url = asString(obj.url);
  if (!id || !url) return null;
  return {
    id,
    url,
    storage_path: asString(obj.storage_path),
    mime_type: asString(obj.mime_type),
    size_bytes: asNumber(obj.size_bytes),
    alt: asString(obj.alt),
    source_type: asString(obj.source_type),
    source_url: asNullableString(obj.source_url),
    created_at: asString(obj.created_at),
  };
}

export async function getAdminMedia(params: { limit?: number; offset?: number } = {}): Promise<AdminMediaListResponse> {
  const url = new URL(apiJoin("admin/media"));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.offset) url.searchParams.set("offset", String(params.offset));

  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);

  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw.map(normalizeAdminMediaAsset).filter((item): item is AdminMediaAsset => item !== null),
    limit: asNumber(payload.limit) || 50,
    offset: asNumber(payload.offset) || 0,
  };
}

export async function uploadAdminMedia(file: File, alt: string): Promise<AdminMediaAsset> {
  if (!file || file.size <= 0) {
    throw new Error("Image file is required");
  }

  const form = new FormData();
  form.set("file", file);
  const normalizedAlt = alt.trim();
  if (normalizedAlt) {
    form.set("alt", normalizedAlt);
  }

  const url = new URL(apiJoin("admin/media/upload"));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
    body: form,
  });
  if (!res.ok) {
    let detail = `Media upload failed: ${res.status}`;
    try {
      const payload = asRecord(await res.json());
      const errorMessage = asString(payload.error);
      if (errorMessage) detail = `${detail} (${errorMessage})`;
    } catch {}
    throw new Error(detail);
  }

  const normalized = normalizeAdminMediaAsset(await res.json());
  if (!normalized) throw new Error("Media upload failed: invalid media response");
  return normalized;
}

export async function importAdminMediaURL(input: { url: string; alt?: string; consent_confirmed: boolean }): Promise<AdminMediaAsset> {
  const payload = {
    url: input.url.trim(),
    alt: input.alt?.trim() || undefined,
    consent_confirmed: input.consent_confirmed,
  };

  const res = await fetch(apiJoin("admin/media/import-url"), {
    method: "POST",
    headers: {
      Authorization: adminAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = `Media import failed: ${res.status}`;
    try {
      const out = asRecord(await res.json());
      const errorMessage = asString(out.error);
      if (errorMessage) detail = `${detail} (${errorMessage})`;
    } catch {}
    throw new Error(detail);
  }

  const normalized = normalizeAdminMediaAsset(await res.json());
  if (!normalized) throw new Error("Media import failed: invalid media response");
  return normalized;
}

export type AdminCategoryMutationInput = {
  slug: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  default_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

export type AdminProductMutationInput = {
  slug: string;
  title: string;
  description?: string;
  status?: string;
  tags?: string[];
  seo_title?: string | null;
  seo_description?: string | null;
};

export type AdminCustomOptionValueMutationInput = {
  title: string;
  sku?: string | null;
  sort_order?: number | null;
  price_type: "fixed" | "percent";
  price_value: number;
  is_default?: boolean;
};

export type AdminCustomOptionMutationInput = {
  store_id?: string | null;
  code: string;
  title: string;
  type_group: "text" | "file" | "select" | "date";
  type: "field" | "area" | "file" | "dropdown" | "radio" | "checkbox" | "multiple" | "date" | "datetime" | "time";
  required?: boolean;
  sort_order?: number | null;
  price_type?: "fixed" | "percent" | null;
  price_value?: number | null;
  is_active?: boolean;
  values?: AdminCustomOptionValueMutationInput[];
};

export type AdminProductCustomOptionAssignInput = {
  option_id: string;
  sort_order?: number | null;
};

export type AdminCreateVariantInput = {
  sku: string;
  price_cents: number;
  stock: number;
  currency?: string;
};

type AdminCategoryIDsInput = {
  product_ids: string[];
  category_ids: string[];
};

export type AdminDiscountInput =
  | { mode: "price"; discount_price_cents: number }
  | { mode: "percent"; discount_percent: number };

export async function createAdminCategory(input: AdminCategoryMutationInput): Promise<Category> {
  const out = await adminCatalogRequest<unknown>({
    path: "admin/catalog/categories",
    method: "POST",
    body: input,
  });
  const normalized = normalizeCategory(out);
  if (!normalized) throw new Error("Admin catalog request failed: invalid category response");
  return normalized;
}

export async function updateAdminCategory(id: string, input: AdminCategoryMutationInput): Promise<Category> {
  const out = await adminCatalogRequest<unknown>({
    path: `admin/catalog/categories/${encodeURIComponent(id)}`,
    method: "PATCH",
    body: input,
  });
  const normalized = normalizeCategory(out);
  if (!normalized) throw new Error("Admin catalog request failed: invalid category response");
  return normalized;
}

export async function deleteAdminCategory(id: string): Promise<AdminDeleteCategoryResult> {
  const url = new URL(apiJoin(`admin/catalog/categories/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `Admin catalog request failed: ${res.status}`;
    try {
      const payload = asRecord(await res.json());
      const errorMessage = asString(payload.error);
      if (errorMessage) detail = `${detail} (${errorMessage})`;
    } catch {}
    throw new Error(detail);
  }
  const payload = asRecord(await res.json());
  return {
    deleted_category_id: asString(payload.deleted_category_id),
    deleted_category_slug: asString(payload.deleted_category_slug),
    affected_products: asNumber(payload.affected_products),
    reassigned_products: asNumber(payload.reassigned_products),
    fallback_category: asString(payload.fallback_category),
  };
}

export async function createAdminProduct(input: AdminProductMutationInput): Promise<Product> {
  const out = await adminCatalogRequest<unknown>({
    path: "admin/catalog/products",
    method: "POST",
    body: input,
  });
  return normalizeProduct(out);
}

export async function getAdminCustomOptions(params: { q?: string; type_group?: string } = {}): Promise<{ items: AdminCustomOption[] }> {
  const url = new URL(apiJoin("admin/custom-options"));
  const query = params.q?.trim();
  const typeGroup = params.type_group?.trim().toLowerCase();
  if (query) url.searchParams.set("q", query);
  if (typeGroup) url.searchParams.set("type_group", typeGroup);

  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch custom options: ${res.status}`);
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw.map(normalizeCustomOption).filter((item): item is AdminCustomOption => item !== null),
  };
}

export async function getAdminCustomOption(id: string): Promise<AdminCustomOption> {
  const url = new URL(apiJoin(`admin/custom-options/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch custom option: ${res.status}`);
  const normalized = normalizeCustomOption(await res.json());
  if (!normalized) throw new Error("Failed to fetch custom option: invalid response");
  return normalized;
}

export async function createAdminCustomOption(input: AdminCustomOptionMutationInput): Promise<AdminCustomOption> {
  const out = await adminCatalogRequest<unknown>({
    path: "admin/custom-options",
    method: "POST",
    body: input,
  });
  const normalized = normalizeCustomOption(out);
  if (!normalized) throw new Error("Admin custom option request failed: invalid response");
  return normalized;
}

export async function updateAdminCustomOption(id: string, input: AdminCustomOptionMutationInput): Promise<AdminCustomOption> {
  const out = await adminCatalogRequest<unknown>({
    path: `admin/custom-options/${encodeURIComponent(id)}`,
    method: "PUT",
    body: input,
  });
  const normalized = normalizeCustomOption(out);
  if (!normalized) throw new Error("Admin custom option request failed: invalid response");
  return normalized;
}

export async function deleteAdminCustomOption(id: string): Promise<{ id: string }> {
  const url = new URL(apiJoin(`admin/custom-options/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `Admin custom option request failed: ${res.status}`;
    try {
      const payload = asRecord(await res.json());
      const errorMessage = asString(payload.error);
      if (errorMessage) detail = `${detail} (${errorMessage})`;
    } catch {}
    throw new Error(detail);
  }
  const payload = asRecord(await res.json());
  return { id: asString(payload.id) };
}

export async function getAdminProductCustomOptions(productID: string): Promise<{ items: AdminProductCustomOptionAssignment[] }> {
  const url = new URL(apiJoin(`admin/products/${encodeURIComponent(productID)}/custom-options`));
  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch product custom options: ${res.status}`);

  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw
      .map(normalizeProductCustomOptionAssignment)
      .filter((item): item is AdminProductCustomOptionAssignment => item !== null),
  };
}

export async function attachAdminProductCustomOption(
  productID: string,
  input: AdminProductCustomOptionAssignInput,
): Promise<AdminProductCustomOptionAssignment> {
  const out = await adminCatalogRequest<unknown>({
    path: `admin/products/${encodeURIComponent(productID)}/custom-options`,
    method: "POST",
    body: input,
  });
  const normalized = normalizeProductCustomOptionAssignment(out);
  if (!normalized) throw new Error("Admin custom option assignment request failed: invalid response");
  return normalized;
}

export async function detachAdminProductCustomOption(productID: string, optionID: string): Promise<{ product_id: string; option_id: string }> {
  const url = new URL(apiJoin(`admin/products/${encodeURIComponent(productID)}/custom-options/${encodeURIComponent(optionID)}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `Admin custom option assignment request failed: ${res.status}`;
    try {
      const payload = asRecord(await res.json());
      const errorMessage = asString(payload.error);
      if (errorMessage) detail = `${detail} (${errorMessage})`;
    } catch {}
    throw new Error(detail);
  }
  const payload = asRecord(await res.json());
  return {
    product_id: asString(payload.product_id),
    option_id: asString(payload.option_id),
  };
}

export async function updateAdminProduct(id: string, input: AdminProductMutationInput): Promise<Product> {
  const out = await adminCatalogRequest<unknown>({
    path: `admin/catalog/products/${encodeURIComponent(id)}`,
    method: "PATCH",
    body: input,
  });
  return normalizeProduct(out);
}

export async function deleteAdminProduct(id: string): Promise<{ id: string }> {
  const url = new URL(apiJoin(`admin/catalog/products/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `Admin catalog request failed: ${res.status}`;
    try {
      const payload = asRecord(await res.json());
      const errorMessage = asString(payload.error);
      if (errorMessage) detail = `${detail} (${errorMessage})`;
    } catch {}
    throw new Error(detail);
  }
  const payload = asRecord(await res.json());
  return { id: asString(payload.id) };
}

export async function createAdminProductVariant(productID: string, input: AdminCreateVariantInput): Promise<ProductVariant> {
  const out = await adminCatalogRequest<unknown>({
    path: `admin/catalog/products/${encodeURIComponent(productID)}/variants`,
    method: "POST",
    body: input,
  });
  const normalized = normalizeVariant(out);
  if (!normalized) throw new Error("Admin catalog request failed: invalid variant response");
  return normalized;
}

export async function setAdminProductCategories(productID: string, categoryIDs: string[]): Promise<void> {
  await adminCatalogRequest({
    path: `admin/catalog/products/${encodeURIComponent(productID)}/categories`,
    method: "PUT",
    body: { category_ids: categoryIDs },
  });
}

export async function bulkAssignAdminProductCategories(input: AdminCategoryIDsInput): Promise<{ affected: number }> {
  return adminCatalogRequest<{ affected: number }>({
    path: "admin/catalog/products/categories/bulk-assign",
    method: "POST",
    body: input,
  });
}

export async function bulkRemoveAdminProductCategories(input: AdminCategoryIDsInput): Promise<{ affected: number }> {
  return adminCatalogRequest<{ affected: number }>({
    path: "admin/catalog/products/categories/bulk-remove",
    method: "POST",
    body: input,
  });
}

export async function applyAdminProductDiscount(productID: string, discount: AdminDiscountInput): Promise<{ updated_variants: number }> {
  return adminCatalogRequest<{ updated_variants: number }>({
    path: `admin/catalog/products/${encodeURIComponent(productID)}/discount`,
    method: "POST",
    body: discount,
  });
}

export async function bulkApplyAdminProductDiscount(input: {
  product_ids: string[];
} & AdminDiscountInput): Promise<{ updated_variants: number }> {
  return adminCatalogRequest<{ updated_variants: number }>({
    path: "admin/catalog/products/discount/bulk",
    method: "POST",
    body: input,
  });
}
