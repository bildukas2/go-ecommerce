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
  swatch_hex?: string | null;
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
  display_mode?: "default" | "buttons" | "color_buttons";
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
    swatch_hex: asNullableString(obj.swatch_hex),
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

  const rawDisplayMode = asString(obj.display_mode || "default").toLowerCase();
  let displayMode: AdminCustomOption["display_mode"] = "default";
  if (["default", "buttons", "color_buttons"].includes(rawDisplayMode)) {
    displayMode = rawDisplayMode as AdminCustomOption["display_mode"];
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
    display_mode: displayMode,
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

async function apiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = asRecord(await res.json());
    const message = asString(payload.error);
    if (message) return message;
  } catch {}
  return fallback;
}

export class BlockedIPError extends Error {
  redirectTo: string;

  constructor(message: string, redirectTo = "/blocked") {
    super(message);
    this.name = "BlockedIPError";
    this.redirectTo = redirectTo;
  }
}

export function isBlockedIPError(error: unknown): error is BlockedIPError {
  return error instanceof BlockedIPError;
}

async function throwBlockedIPErrorIfNeeded(res: Response): Promise<void> {
  if (res.status !== 403) return;

  let redirectTo = res.headers.get("X-Blocked-Redirect") || "/blocked";
  let message = "IP blocked";
  try {
    const payload = asRecord(await res.clone().json());
    const maybeRedirect = asString(payload.redirect_to).trim();
    if (maybeRedirect.startsWith("/")) redirectTo = maybeRedirect;
    const maybeMessage = asString(payload.error).trim();
    if (maybeMessage) message = maybeMessage;
  } catch {}
  throw new BlockedIPError(message, redirectTo);
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
  CustomOptions?: CartItemCustomOption[];
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type CartItemCustomOption = {
  OptionID: string;
  Title: string;
  Type: string;
  ValueID?: string;
  ValueIDs?: string[];
  ValueText?: string;
  ValueTitle?: string;
  ValueTitles?: string[];
  PriceDeltaCents?: number;
};

export type CartCustomOptionSelectionInput = {
  option_id: string;
  type: "field" | "area" | "file" | "dropdown" | "radio" | "checkbox" | "multiple" | "date" | "datetime" | "time";
  value_id?: string;
  value_ids?: string[];
  value_text?: string;
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
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(`Failed to initialize cart: ${res.status}`);
  }
  return res.json();
}

export async function getCart(): Promise<Cart> {
  const url = new URL(apiJoin("cart"));
  const res = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch cart: ${res.status}`);
  return res.json();
}

export async function addCartItem(
  variantId: string,
  quantity: number,
  customOptions: CartCustomOptionSelectionInput[] = [],
): Promise<Cart> {
  const url = new URL(apiJoin("cart/items"));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ variant_id: variantId, quantity, custom_options: customOptions }),
  });
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(`Failed to add item: ${res.status}`);
  }
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
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(`Failed to update item: ${res.status}`);
  }
  return res.json();
}

export async function removeCartItem(itemId: string): Promise<Cart> {
  const url = new URL(apiJoin(`cart/items/${encodeURIComponent(itemId)}`));
  const res = await fetch(url.toString(), { method: "DELETE", credentials: "include" });
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(`Failed to remove item: ${res.status}`);
  }
  return res.json();
}

export async function checkout(): Promise<{ order_id: string; checkout_url: string; status: string }> {
  const url = new URL(apiJoin("checkout"));
  const res = await fetch(url.toString(), { method: "POST", credentials: "include" });
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(`Failed to checkout: ${res.status}`);
  }
  const payload: unknown = await res.json();
  return parseCheckoutResponse(payload);
}

export type AccountCustomer = {
  id: string;
  email: string;
  created_at: string;
};

export type AccountFavorite = {
  product_id: string;
  slug: string;
  title: string;
  default_image_url: string | null;
  price_cents: number | null;
  currency: string | null;
  created_at: string;
};

export type AccountFavoritesResponse = {
  items: AccountFavorite[];
  total: number;
  page: number;
  limit: number;
};

export type AccountOrderItem = {
  product_id: string;
  slug: string;
  title: string;
  quantity: number;
  unit_price_cents: number;
  currency: string;
};

export type AccountOrder = {
  id: string;
  number: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  items: AccountOrderItem[];
};

export type AccountOrdersResponse = {
  items: AccountOrder[];
  total: number;
  page: number;
  limit: number;
};

type AccountRequestOptions = {
  cookieHeader?: string;
};

function accountHeaders(options?: AccountRequestOptions): HeadersInit | undefined {
  if (!options?.cookieHeader) return undefined;
  return { Cookie: options.cookieHeader };
}

function accountFetchInit(base?: RequestInit, options?: AccountRequestOptions): RequestInit {
  return {
    ...base,
    headers: {
      ...(base?.headers ?? {}),
      ...(accountHeaders(options) ?? {}),
    },
    ...(options?.cookieHeader ? { cache: "no-store" } : { credentials: "include" }),
  };
}

function normalizeAccountCustomer(raw: unknown): AccountCustomer {
  const obj = asRecord(raw);
  return {
    id: asString(obj.id),
    email: asString(obj.email),
    created_at: asString(obj.created_at ?? obj.createdAt),
  };
}

function normalizeAccountFavorite(raw: unknown): AccountFavorite | null {
  const obj = asRecord(raw);
  const productID = asString(obj.product_id ?? obj.ProductID);
  if (!productID) return null;
  return {
    product_id: productID,
    slug: asString(obj.slug ?? obj.Slug),
    title: asString(obj.title ?? obj.Title),
    default_image_url: asNullableString(obj.default_image_url ?? obj.DefaultImageURL),
    price_cents:
      obj.price_cents === null || obj.PriceCents === null
        ? null
        : (obj.price_cents ?? obj.PriceCents) === undefined
          ? null
          : asNumber(obj.price_cents ?? obj.PriceCents),
    currency: asNullableString(obj.currency ?? obj.Currency),
    created_at: asString(obj.created_at ?? obj.CreatedAt),
  };
}

function normalizeAccountOrderItem(raw: unknown): AccountOrderItem | null {
  const obj = asRecord(raw);
  const productID = asString(obj.product_id ?? obj.ProductID);
  if (!productID) return null;
  return {
    product_id: productID,
    slug: asString(obj.slug ?? obj.Slug),
    title: asString(obj.title ?? obj.Title),
    quantity: asNumber(obj.quantity ?? obj.Quantity),
    unit_price_cents: asNumber(obj.unit_price_cents ?? obj.UnitPriceCents),
    currency: asString(obj.currency ?? obj.Currency),
  };
}

function normalizeAccountOrder(raw: unknown): AccountOrder | null {
  const obj = asRecord(raw);
  const id = asString(obj.id ?? obj.ID);
  if (!id) return null;
  const maybeItems = obj.items ?? obj.Items;
  const itemsRaw: unknown[] = Array.isArray(maybeItems) ? maybeItems : [];
  return {
    id,
    number: asString(obj.number ?? obj.Number),
    status: asString(obj.status ?? obj.Status),
    total_cents: asNumber(obj.total_cents ?? obj.TotalCents),
    currency: asString(obj.currency ?? obj.Currency),
    created_at: asString(obj.created_at ?? obj.CreatedAt),
    items: itemsRaw.map(normalizeAccountOrderItem).filter((item): item is AccountOrderItem => item !== null),
  };
}

export async function registerAccount(email: string, password: string, options?: AccountRequestOptions): Promise<AccountCustomer> {
  const res = await fetch(
    apiJoin("auth/register"),
    accountFetchInit(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
      options,
    ),
  );
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(await apiErrorMessage(res, `Failed to register: ${res.status}`));
  }
  return normalizeAccountCustomer(await res.json());
}

export async function loginAccount(email: string, password: string, options?: AccountRequestOptions): Promise<AccountCustomer> {
  const res = await fetch(
    apiJoin("auth/login"),
    accountFetchInit(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
      options,
    ),
  );
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(await apiErrorMessage(res, `Failed to login: ${res.status}`));
  }
  return normalizeAccountCustomer(await res.json());
}

export async function logoutAccount(options?: AccountRequestOptions): Promise<void> {
  const res = await fetch(
    apiJoin("auth/logout"),
    accountFetchInit(
      {
        method: "POST",
      },
      options,
    ),
  );
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(await apiErrorMessage(res, `Failed to logout: ${res.status}`));
  }
}

export async function getCurrentAccount(options?: AccountRequestOptions): Promise<AccountCustomer> {
  const res = await fetch(
    apiJoin("auth/me"),
    accountFetchInit(
      {
        method: "GET",
      },
      options,
    ),
  );
  if (!res.ok) throw new Error(await apiErrorMessage(res, `Failed to fetch account: ${res.status}`));
  return normalizeAccountCustomer(await res.json());
}

export async function getAccountFavorites(
  params: { page?: number; limit?: number } = {},
  options?: AccountRequestOptions,
): Promise<AccountFavoritesResponse> {
  const url = new URL(apiJoin("account/favorites"));
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(
    url.toString(),
    accountFetchInit(
      {
        method: "GET",
      },
      options,
    ),
  );
  if (!res.ok) throw new Error(await apiErrorMessage(res, `Failed to load favorites: ${res.status}`));
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw.map(normalizeAccountFavorite).filter((item): item is AccountFavorite => item !== null),
    total: asNumber(payload.total),
    page: asNumber(payload.page) || 1,
    limit: asNumber(payload.limit) || 20,
  };
}

export async function addAccountFavorite(productID: string, options?: AccountRequestOptions): Promise<{ product_id: string }> {
  const res = await fetch(
    apiJoin("account/favorites"),
    accountFetchInit(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productID }),
      },
      options,
    ),
  );
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(await apiErrorMessage(res, `Failed to add favorite: ${res.status}`));
  }
  const payload = asRecord(await res.json());
  return { product_id: asString(payload.product_id) };
}

export async function removeAccountFavorite(productID: string, options?: AccountRequestOptions): Promise<void> {
  const res = await fetch(
    apiJoin(`account/favorites/${encodeURIComponent(productID)}`),
    accountFetchInit(
      {
        method: "DELETE",
      },
      options,
    ),
  );
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(await apiErrorMessage(res, `Failed to remove favorite: ${res.status}`));
  }
}

export async function getAccountOrders(
  params: { page?: number; limit?: number } = {},
  options?: AccountRequestOptions,
): Promise<AccountOrdersResponse> {
  const url = new URL(apiJoin("account/orders"));
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(
    url.toString(),
    accountFetchInit(
      {
        method: "GET",
      },
      options,
    ),
  );
  if (!res.ok) throw new Error(await apiErrorMessage(res, `Failed to load order history: ${res.status}`));
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw.map(normalizeAccountOrder).filter((item): item is AccountOrder => item !== null),
    total: asNumber(payload.total),
    page: asNumber(payload.page) || 1,
    limit: asNumber(payload.limit) || 20,
  };
}

export async function changeAccountPassword(currentPassword: string, newPassword: string, options?: AccountRequestOptions): Promise<void> {
  const res = await fetch(
    apiJoin("account/change-password"),
    accountFetchInit(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      },
      options,
    ),
  );
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(await apiErrorMessage(res, `Failed to change password: ${res.status}`));
  }
}

export async function submitBlockedReport(input: BlockedReportInput): Promise<void> {
  const url = new URL(apiJoin("support/blocked-report"));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(await apiErrorMessage(res, `Failed to submit blocked report: ${res.status}`));
  }
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

export type AdminCustomerSummary = {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string;
  last_name: string;
  status: "active" | "disabled";
  group_id: string | null;
  group_name: string | null;
  group_code: string | null;
  is_anonymous: boolean;
  latest_ip: string | null;
  last_login_at: string | null;
  shipping_full_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postcode: string;
  shipping_country: string;
  billing_full_name: string;
  billing_address1: string;
  billing_address2: string;
  billing_city: string;
  billing_state: string;
  billing_postcode: string;
  billing_country: string;
  company_name: string;
  company_vat: string;
  invoice_email: string | null;
  wants_invoice: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminCustomerMutationInput = {
  email?: string | null;
  phone?: string | null;
  first_name: string;
  last_name: string;
  status?: "active" | "disabled";
  group_id?: string | null;
  is_anonymous?: boolean;
  shipping_full_name?: string;
  shipping_phone?: string;
  shipping_address1?: string;
  shipping_address2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postcode?: string;
  shipping_country?: string;
  billing_full_name?: string;
  billing_address1?: string;
  billing_address2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postcode?: string;
  billing_country?: string;
  company_name?: string;
  company_vat?: string;
  invoice_email?: string | null;
  wants_invoice?: boolean;
};

export type AdminCustomerGroup = {
  id: string;
  name: string;
  code: string;
  is_default: boolean;
  customer_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminCustomerGroupMutationInput = {
  name: string;
  code?: string;
};

export type AdminCustomerActionLog = {
  id: string;
  customer_id: string | null;
  customer_email: string | null;
  ip: string;
  user_agent: string | null;
  action: string;
  severity: string | null;
  meta_json: Record<string, unknown>;
  created_at: string;
};

export type AdminBlockedIP = {
  id: string;
  ip: string;
  reason: string | null;
  created_by_admin_id: string | null;
  expires_at: string | null;
  created_at: string;
};

export type AdminBlockedIPMutationInput = {
  ip: string;
  reason?: string | null;
  expires_at?: string | null;
};

export type BlockedReportInput = {
  email: string;
  message: string;
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

function normalizeAdminCustomerSummary(raw: unknown): AdminCustomerSummary | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;
  const statusRaw = asString(obj.status).toLowerCase();
  const status = statusRaw === "disabled" ? "disabled" : "active";
  return {
    id,
    email: asNullableString(obj.email),
    phone: asNullableString(obj.phone),
    first_name: asString(obj.first_name),
    last_name: asString(obj.last_name),
    status,
    group_id: asNullableString(obj.group_id),
    group_name: asNullableString(obj.group_name),
    group_code: asNullableString(obj.group_code),
    is_anonymous: asBoolean(obj.is_anonymous),
    latest_ip: asNullableString(obj.latest_ip),
    last_login_at: asNullableString(obj.last_login_at),
    shipping_full_name: asString(obj.shipping_full_name),
    shipping_phone: asString(obj.shipping_phone),
    shipping_address1: asString(obj.shipping_address1),
    shipping_address2: asString(obj.shipping_address2),
    shipping_city: asString(obj.shipping_city),
    shipping_state: asString(obj.shipping_state),
    shipping_postcode: asString(obj.shipping_postcode),
    shipping_country: asString(obj.shipping_country),
    billing_full_name: asString(obj.billing_full_name),
    billing_address1: asString(obj.billing_address1),
    billing_address2: asString(obj.billing_address2),
    billing_city: asString(obj.billing_city),
    billing_state: asString(obj.billing_state),
    billing_postcode: asString(obj.billing_postcode),
    billing_country: asString(obj.billing_country),
    company_name: asString(obj.company_name),
    company_vat: asString(obj.company_vat),
    invoice_email: asNullableString(obj.invoice_email),
    wants_invoice: asBoolean(obj.wants_invoice),
    created_at: asString(obj.created_at),
    updated_at: asString(obj.updated_at),
  };
}

export async function getAdminCustomers(params: {
  page?: number;
  limit?: number;
  q?: string;
  group?: string;
  status?: "active" | "disabled";
  anonymous?: "anonymous" | "registered";
  sort?: "created_desc" | "created_asc" | "name_asc" | "name_desc" | "email_asc" | "email_desc" | "anonymous_asc" | "anonymous_desc";
} = {}): Promise<{ items: AdminCustomerSummary[]; total: number; page: number; limit: number; }> {
  const url = new URL(apiJoin("admin/customers"));
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.q?.trim()) url.searchParams.set("q", params.q.trim());
  if (params.group?.trim()) url.searchParams.set("group", params.group.trim());
  if (params.status) url.searchParams.set("status", params.status);
  if (params.anonymous) url.searchParams.set("anonymous", params.anonymous);
  if (params.sort) url.searchParams.set("sort", params.sort);
  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, `Failed to fetch customers: ${res.status}`));
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw.map(normalizeAdminCustomerSummary).filter((item): item is AdminCustomerSummary => item !== null),
    total: asNumber(payload.total),
    page: asNumber(payload.page) || 1,
    limit: asNumber(payload.limit) || 20,
  };
}

export async function createAdminCustomer(input: AdminCustomerMutationInput): Promise<AdminCustomerSummary> {
  const url = new URL(apiJoin("admin/customers"));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: adminAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to create customer: ${res.status}`));
  }
  const normalized = normalizeAdminCustomerSummary(await res.json());
  if (!normalized) throw new Error("Failed to create customer: invalid response");
  return normalized;
}

export async function updateAdminCustomer(id: string, input: AdminCustomerMutationInput): Promise<AdminCustomerSummary> {
  const url = new URL(apiJoin(`admin/customers/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: adminAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to update customer: ${res.status}`));
  }
  const normalized = normalizeAdminCustomerSummary(await res.json());
  if (!normalized) throw new Error("Failed to update customer: invalid response");
  return normalized;
}

export async function updateAdminCustomerStatus(id: string, status: "active" | "disabled"): Promise<AdminCustomerSummary> {
  const url = new URL(apiJoin(`admin/customers/${encodeURIComponent(id)}/status`));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: adminAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to update customer status: ${res.status}`));
  }
  const normalized = normalizeAdminCustomerSummary(await res.json());
  if (!normalized) throw new Error("Failed to update customer status: invalid response");
  return normalized;
}

function normalizeAdminCustomerGroup(raw: unknown): AdminCustomerGroup | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;
  return {
    id,
    name: asString(obj.name),
    code: asString(obj.code),
    is_default: asBoolean(obj.is_default),
    customer_count: asNumber(obj.customer_count),
    created_at: asString(obj.created_at),
    updated_at: asString(obj.updated_at),
  };
}

function normalizeMetaJSON(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function normalizeAdminCustomerActionLog(raw: unknown): AdminCustomerActionLog | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;
  return {
    id,
    customer_id: asNullableString(obj.customer_id),
    customer_email: asNullableString(obj.customer_email),
    ip: asString(obj.ip),
    user_agent: asNullableString(obj.user_agent),
    action: asString(obj.action),
    severity: asNullableString(obj.severity),
    meta_json: normalizeMetaJSON(obj.meta_json),
    created_at: asString(obj.created_at),
  };
}

function normalizeAdminBlockedIP(raw: unknown): AdminBlockedIP | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  const ip = asString(obj.ip);
  if (!id || !ip) return null;
  return {
    id,
    ip,
    reason: asNullableString(obj.reason),
    created_by_admin_id: asNullableString(obj.created_by_admin_id),
    expires_at: asNullableString(obj.expires_at),
    created_at: asString(obj.created_at),
  };
}

export async function getAdminCustomerGroups(): Promise<{ items: AdminCustomerGroup[] }> {
  const url = new URL(apiJoin("admin/customers/groups"));
  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch customer groups: ${res.status}`);
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw.map(normalizeAdminCustomerGroup).filter((item): item is AdminCustomerGroup => item !== null),
  };
}

export async function getAdminCustomerActionLogs(params: {
  page?: number;
  limit?: number;
  q?: string;
  action?: string;
  from?: string;
  to?: string;
} = {}): Promise<{ items: AdminCustomerActionLog[]; total: number; page: number; limit: number }> {
  const url = new URL(apiJoin("admin/customers/logs"));
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.q?.trim()) url.searchParams.set("q", params.q.trim());
  if (params.action?.trim()) url.searchParams.set("action", params.action.trim());
  if (params.from?.trim()) url.searchParams.set("from", params.from.trim());
  if (params.to?.trim()) url.searchParams.set("to", params.to.trim());

  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, `Failed to fetch customer action logs: ${res.status}`));

  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw.map(normalizeAdminCustomerActionLog).filter((item): item is AdminCustomerActionLog => item !== null),
    total: asNumber(payload.total),
    page: asNumber(payload.page) || 1,
    limit: asNumber(payload.limit) || 20,
  };
}

export async function getAdminBlockedIPs(): Promise<{ items: AdminBlockedIP[] }> {
  const url = new URL(apiJoin("admin/security/blocked-ips"));
  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, `Failed to fetch blocked IPs: ${res.status}`));
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw.map(normalizeAdminBlockedIP).filter((item): item is AdminBlockedIP => item !== null),
  };
}

export async function createAdminBlockedIP(input: AdminBlockedIPMutationInput): Promise<AdminBlockedIP> {
  const url = new URL(apiJoin("admin/security/blocked-ips"));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: adminAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, `Failed to block IP: ${res.status}`));
  const normalized = normalizeAdminBlockedIP(await res.json());
  if (!normalized) throw new Error("Failed to block IP: invalid response");
  return normalized;
}

export async function deleteAdminBlockedIP(id: string): Promise<{ id: string; ip: string }> {
  const url = new URL(apiJoin(`admin/security/blocked-ips/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, `Failed to unblock IP: ${res.status}`));
  const payload = asRecord(await res.json());
  return {
    id: asString(payload.id),
    ip: asString(payload.ip),
  };
}

export async function createAdminCustomerGroup(input: AdminCustomerGroupMutationInput): Promise<AdminCustomerGroup> {
  const url = new URL(apiJoin("admin/customers/groups"));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: adminAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to create customer group: ${res.status}`));
  }
  const normalized = normalizeAdminCustomerGroup(await res.json());
  if (!normalized) throw new Error("Failed to create customer group: invalid response");
  return normalized;
}

export async function updateAdminCustomerGroup(id: string, input: AdminCustomerGroupMutationInput): Promise<AdminCustomerGroup> {
  const url = new URL(apiJoin(`admin/customers/groups/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: adminAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to update customer group: ${res.status}`));
  }
  const normalized = normalizeAdminCustomerGroup(await res.json());
  if (!normalized) throw new Error("Failed to update customer group: invalid response");
  return normalized;
}

export async function deleteAdminCustomerGroup(id: string): Promise<{ id: string }> {
  const url = new URL(apiJoin(`admin/customers/groups/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to delete customer group: ${res.status}`));
  }
  const payload = asRecord(await res.json());
  return { id: asString(payload.id) };
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

export async function updateAdminOrderStatus(orderID: string, status: string): Promise<{ status: string }> {
  const url = new URL(apiJoin("admin/orders/status"));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: adminAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ order_id: orderID, status }),
  });
  if (!res.ok) throw new Error(`Failed to update order status: ${res.status}`);
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
  swatch_hex?: string | null;
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
  display_mode?: "default" | "buttons" | "color_buttons";
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

export type ShippingProvider = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  mode: "sandbox" | "live";
  config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ShippingZone = {
  id: string;
  name: string;
  countries_json: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ShippingMethod = {
  id: string;
  zone_id: string;
  provider_key: string;
  service_code: string;
  title: string;
  enabled: boolean;
  sort_order: number;
  pricing_mode: "fixed" | "table" | "provider";
  pricing_rules_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TerminalsCacheItem = {
  provider: string;
  country: string;
  terminals: unknown[];
  fetched_at: string;
};

function normalizeShippingProvider(raw: unknown): ShippingProvider | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;

  const mode = asString(obj.mode).toLowerCase();
  if (mode !== "sandbox" && mode !== "live") return null;

  return {
    id,
    key: asString(obj.key),
    name: asString(obj.name),
    enabled: asBoolean(obj.enabled),
    mode: mode as "sandbox" | "live",
    config_json: asRecord(obj.config_json ?? obj.configJSON),
    created_at: asString(obj.created_at ?? obj.createdAt),
    updated_at: asString(obj.updated_at ?? obj.updatedAt),
  };
}

function normalizeShippingZone(raw: unknown): ShippingZone | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;

  let countriesArray: string[] = [];
  const countriesJsonRaw = obj.countries_json ?? obj.countriesJSON ?? obj.CountriesJSON;
  if (typeof countriesJsonRaw === "string") {
    try {
      let jsonStr = countriesJsonRaw;
      if (countriesJsonRaw.match(/^[A-Za-z0-9+/=]+$/)) {
        try {
          jsonStr = atob(countriesJsonRaw);
        } catch {
        }
      }
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        countriesArray = parsed.map((c) => asString(c)).filter((c) => c.length > 0);
      }
    } catch {}
  } else if (Array.isArray(countriesJsonRaw)) {
    countriesArray = countriesJsonRaw.map((c) => asString(c)).filter((c) => c.length > 0);
  }

  return {
    id,
    name: asString(obj.name),
    countries_json: countriesArray,
    enabled: asBoolean(obj.enabled),
    created_at: asString(obj.created_at ?? obj.createdAt),
    updated_at: asString(obj.updated_at ?? obj.updatedAt),
  };
}

function normalizeShippingMethod(raw: unknown): ShippingMethod | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;

  const pricingMode = asString(obj.pricing_mode ?? obj.pricingMode).toLowerCase();
  if (pricingMode !== "fixed" && pricingMode !== "table" && pricingMode !== "provider") {
    return null;
  }

  return {
    id,
    zone_id: asString(obj.zone_id ?? obj.zoneID),
    provider_key: asString(obj.provider_key ?? obj.providerKey),
    service_code: asString(obj.service_code ?? obj.serviceCode),
    title: asString(obj.title),
    enabled: asBoolean(obj.enabled),
    sort_order: asNumber(obj.sort_order ?? obj.sortOrder),
    pricing_mode: pricingMode as "fixed" | "table" | "provider",
    pricing_rules_json: asRecord(obj.pricing_rules_json ?? obj.pricingRulesJSON),
    created_at: asString(obj.created_at ?? obj.createdAt),
    updated_at: asString(obj.updated_at ?? obj.updatedAt),
  };
}

function normalizeTerminalsCacheItem(raw: unknown): TerminalsCacheItem | null {
  const obj = asRecord(raw);
  const provider = asString(obj.provider);
  const country = asString(obj.country);
  if (!provider || !country) return null;

  const terminalsRaw = Array.isArray(obj.terminals) ? obj.terminals : [];
  return {
    provider,
    country,
    terminals: terminalsRaw,
    fetched_at: asString(obj.fetched_at ?? obj.fetchedAt),
  };
}

export async function getShippingProviders(): Promise<ShippingProvider[]> {
  const url = new URL(apiJoin("admin/shipping/providers"));
  const res = await fetch(url.toString(), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch shipping providers: ${res.status}`);
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.providers)
      ? payload.providers
      : [];
  return itemsRaw.map(normalizeShippingProvider).filter((item): item is ShippingProvider => item !== null);
}

export async function updateShippingProvider(key: string, data: Partial<ShippingProvider>): Promise<ShippingProvider> {
  const url = new URL(apiJoin(`admin/shipping/providers/${encodeURIComponent(key)}`));
  const payload = {
    name: data.name || "",
    mode: data.mode || "sandbox",
    enabled: data.enabled || false,
    config_json: data.config_json || {},
  };
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to update shipping provider: ${res.status}`));
  }
  const normalized = normalizeShippingProvider(await res.json());
  if (!normalized) throw new Error("Failed to update shipping provider: invalid response");
  return normalized;
}

export async function deleteShippingProvider(key: string): Promise<void> {
  const url = new URL(apiJoin(`admin/shipping/providers/${encodeURIComponent(key)}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to delete shipping provider: ${res.status}`));
  }
}

export async function getShippingZones(): Promise<ShippingZone[]> {
  const url = new URL(apiJoin("admin/shipping/zones"));
  const res = await fetch(url.toString(), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch shipping zones: ${res.status}`);
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.zones)
      ? payload.zones
      : [];
  return itemsRaw.map(normalizeShippingZone).filter((item): item is ShippingZone => item !== null);
}

export async function createShippingZone(data: Omit<ShippingZone, "id" | "created_at" | "updated_at">): Promise<ShippingZone> {
  const url = new URL(apiJoin("admin/shipping/zones"));
  const payload = {
    name: data.name || "",
    countries_json: data.countries_json || [],
    enabled: data.enabled || false,
  };
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to create shipping zone: ${res.status}`));
  }
  const normalized = normalizeShippingZone(await res.json());
  if (!normalized) throw new Error("Failed to create shipping zone: invalid response");
  return normalized;
}

export async function updateShippingZone(id: string, data: Partial<ShippingZone>): Promise<ShippingZone> {
  const url = new URL(apiJoin(`admin/shipping/zones/${encodeURIComponent(id)}`));
  const payload = {
    name: data.name || "",
    countries_json: data.countries_json || [],
    enabled: data.enabled !== undefined ? data.enabled : false,
  };
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to update shipping zone: ${res.status}`));
  }
  const normalized = normalizeShippingZone(await res.json());
  if (!normalized) throw new Error("Failed to update shipping zone: invalid response");
  return normalized;
}

export async function deleteShippingZone(id: string): Promise<void> {
  const url = new URL(apiJoin(`admin/shipping/zones/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to delete shipping zone: ${res.status}`));
  }
}

export async function getShippingMethods(): Promise<ShippingMethod[]> {
  const url = new URL(apiJoin("admin/shipping/methods"));
  const res = await fetch(url.toString(), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch shipping methods: ${res.status}`);
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.methods)
      ? payload.methods
      : [];
  return itemsRaw.map(normalizeShippingMethod).filter((item): item is ShippingMethod => item !== null);
}

export async function createShippingMethod(data: Omit<ShippingMethod, "id" | "created_at" | "updated_at">): Promise<ShippingMethod> {
  const url = new URL(apiJoin("admin/shipping/methods"));
  const payload = {
    zone_id: data.zone_id || "",
    provider_key: data.provider_key || "",
    service_code: data.service_code || "",
    title: data.title || "",
    enabled: data.enabled !== undefined ? data.enabled : true,
    sort_order: data.sort_order || 0,
    pricing_mode: data.pricing_mode || "fixed",
    pricing_rules_json: data.pricing_rules_json || {},
  };
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to create shipping method: ${res.status}`));
  }
  const normalized = normalizeShippingMethod(await res.json());
  if (!normalized) throw new Error("Failed to create shipping method: invalid response");
  return normalized;
}

export async function updateShippingMethod(id: string, data: Partial<ShippingMethod>): Promise<ShippingMethod> {
  const url = new URL(apiJoin(`admin/shipping/methods/${encodeURIComponent(id)}`));
  const payload = {
    zone_id: data.zone_id || "",
    provider_key: data.provider_key || "",
    service_code: data.service_code || "",
    title: data.title || "",
    enabled: data.enabled !== undefined ? data.enabled : true,
    sort_order: data.sort_order || 0,
    pricing_mode: data.pricing_mode || "fixed",
    pricing_rules_json: data.pricing_rules_json || {},
  };
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to update shipping method: ${res.status}`));
  }
  const normalized = normalizeShippingMethod(await res.json());
  if (!normalized) throw new Error("Failed to update shipping method: invalid response");
  return normalized;
}

export async function deleteShippingMethod(id: string): Promise<void> {
  const url = new URL(apiJoin(`admin/shipping/methods/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to delete shipping method: ${res.status}`));
  }
}

export async function getShippingTerminals(provider: string, country: string): Promise<TerminalsCacheItem> {
  const url = new URL(apiJoin("admin/shipping/terminals"));
  url.searchParams.set("provider", provider);
  url.searchParams.set("country", country);
  const res = await fetch(url.toString(), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch shipping terminals: ${res.status}`);
  const normalized = normalizeTerminalsCacheItem(await res.json());
  if (!normalized) throw new Error("Failed to fetch shipping terminals: invalid response");
  return normalized;
}

export async function refreshShippingTerminals(provider: string, country: string): Promise<TerminalsCacheItem> {
  const url = new URL(apiJoin("admin/shipping/terminals"));
  url.searchParams.set("provider", provider);
  url.searchParams.set("country", country);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ provider, country }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to refresh shipping terminals: ${res.status}`));
  }
  const normalized = normalizeTerminalsCacheItem(await res.json());
  if (!normalized) throw new Error("Failed to refresh shipping terminals: invalid response");
  return normalized;
}

export async function deleteShippingTerminals(provider: string, country: string): Promise<void> {
  const url = new URL(apiJoin("admin/shipping/terminals"));
  url.searchParams.set("provider", provider);
  url.searchParams.set("country", country);
  const res = await fetch(url.toString(), {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to delete shipping terminals: ${res.status}`));
  }
}
