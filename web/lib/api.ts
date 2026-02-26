import { API_URL } from "./config";
import { parseCheckoutResponse } from "./checkout-state";

function apiJoin(path: string): string {
  const base = new URL(API_URL);
  const clean = path.replace(/^\/+/, "");
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL(clean, base).toString();
}

function getCSRFToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function mutHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  const csrf = getCSRFToken();
  if (csrf) h["X-CSRF-Token"] = csrf;
  return h;
}

function getCookieValueFromHeader(cookieHeader: string, key: string): string {
  const source = cookieHeader.trim();
  if (!source) return "";
  const pairs = source.split(";");
  for (const pair of pairs) {
    const trimmed = pair.trim();
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    if (trimmed.slice(0, index).trim() !== key) continue;
    return decodeURIComponent(trimmed.slice(index + 1).trim());
  }
  return "";
}

async function getServerCookieHeader(): Promise<string> {
  if (typeof window !== "undefined") return "";
  try {
    const mod = await import("next/headers");
    const store = await mod.cookies();
    return store.toString();
  } catch {
    return "";
  }
}

async function adminRequestHeaders(extra: Record<string, string> = {}): Promise<RequestInit> {
  const headers: Record<string, string> = { ...extra };
  if (typeof window === "undefined") {
    const cookieHeader = await getServerCookieHeader();
    if (cookieHeader) headers.Cookie = cookieHeader;
  }
  return {
    headers,
    credentials: "include",
  };
}

async function adminMutationHeaders(extra: Record<string, string> = {}, includeJSONContentType = true): Promise<RequestInit> {
  const requestInit = await adminRequestHeaders({ ...extra });
  const headers = requestInit.headers as Record<string, string>;
  if (includeJSONContentType && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const csrf = typeof window === "undefined"
    ? getCookieValueFromHeader(headers.Cookie || "", "csrf_token")
    : getCSRFToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  return requestInit;
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

export type AdminPage = {
  id: string;
  title: string;
  title_i18n: Record<string, string>;
  slug: string;
  status: "draft" | "published";
  content_html: string;
  content_html_i18n: Record<string, string>;
  content_json?: any | null;
  editor_mode: "html" | "visual";
  meta_title?: string | null;
  meta_description?: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
};

export type AdminNavigationItem = {
  id: string;
  menu_id: string;
  label: string;
  label_i18n: Record<string, string>;
  type: "page" | "url" | "category";
  page_id?: string | null;
  category_id?: string | null;
  url?: string | null;
  open_in_new_tab: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminNavigationMenu = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminNavigationLocation = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  menu_id?: string | null;
  menu_code?: string | null;
  menu_name?: string | null;
  assignment_updated_at?: string | null;
};

export type StorefrontNavigationItem = {
  label: string;
  href: string;
  type: "page" | "url" | "category";
  open_in_new_tab: boolean;
};

export type StorefrontNavigationMenu = {
  id: string;
  code: string;
  name: string;
  items: StorefrontNavigationItem[];
};

export type StorefrontNavigationLocation = {
  code: string;
  name: string;
  menu: StorefrontNavigationMenu | null;
};

export type AdminPageListResponse = {
  pages: AdminPage[];
  total: number;
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

function normalizeAdminPage(raw: unknown): AdminPage | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;

  const status = asString(obj.status).toLowerCase();
  const editorMode = asString(obj.editor_mode).toLowerCase();

  return {
    id,
    title: asString(obj.title),
    slug: asString(obj.slug),
    status: (status === "published" ? "published" : "draft") as AdminPage["status"],
    content_html: asString(obj.content_html),
    content_json: obj.content_json || null,
    editor_mode: (editorMode === "visual" ? "visual" : "html") as AdminPage["editor_mode"],
    meta_title: asNullableString(obj.meta_title),
    meta_description: asNullableString(obj.meta_description),
    created_at: asString(obj.created_at),
    updated_at: asString(obj.updated_at),
    published_at: asNullableString(obj.published_at),
  };
}

function normalizeAdminNavigationItem(raw: unknown): AdminNavigationItem | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  const menuID = asString(obj.menu_id);
  if (!id) return null;

  const type = asString(obj.type).toLowerCase();
  const normalizedType = (type === "url" || type === "category" ? type : "page") as AdminNavigationItem["type"];

  return {
    id,
    menu_id: menuID,
    label: asString(obj.label),
    type: normalizedType,
    page_id: asNullableString(obj.page_id),
    category_id: asNullableString(obj.category_id),
    url: asNullableString(obj.url),
    open_in_new_tab: asBoolean(obj.open_in_new_tab),
    sort_order: asNumber(obj.sort_order),
    is_active: asBoolean(obj.is_active),
    created_at: asString(obj.created_at),
    updated_at: asString(obj.updated_at),
  };
}

function normalizeAdminNavigationMenu(raw: unknown): AdminNavigationMenu | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  const code = asString(obj.code);
  const name = asString(obj.name);
  if (!id || !code || !name) return null;
  return {
    id,
    code,
    name,
    description: asNullableString(obj.description),
    created_at: asString(obj.created_at),
    updated_at: asString(obj.updated_at),
  };
}

function normalizeAdminNavigationLocation(raw: unknown): AdminNavigationLocation | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  const code = asString(obj.code);
  const name = asString(obj.name);
  if (!id || !code || !name) return null;
  return {
    id,
    code,
    name,
    description: asNullableString(obj.description),
    menu_id: asNullableString(obj.menu_id),
    menu_code: asNullableString(obj.menu_code),
    menu_name: asNullableString(obj.menu_name),
    assignment_updated_at: asNullableString(obj.assignment_updated_at),
  };
}

function normalizeStorefrontNavigationItem(raw: unknown): StorefrontNavigationItem | null {
  const obj = asRecord(raw);
  const label = asString(obj.label);
  const href = asString(obj.href);
  if (!label || !href) return null;

  const typeRaw = asString(obj.type).toLowerCase();
  const type = (typeRaw === "url" || typeRaw === "category" ? typeRaw : "page") as StorefrontNavigationItem["type"];

  return {
    label,
    href,
    type,
    open_in_new_tab: asBoolean(obj.open_in_new_tab),
  };
}

function normalizeStorefrontNavigationMenu(raw: unknown): StorefrontNavigationMenu | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  const code = asString(obj.code);
  const name = asString(obj.name);
  if (!id || !code || !name) return null;

  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
  return {
    id,
    code,
    name,
    items: itemsRaw
      .map(normalizeStorefrontNavigationItem)
      .filter((item): item is StorefrontNavigationItem => item !== null),
  };
}

function normalizeStorefrontNavigationLocation(raw: unknown): StorefrontNavigationLocation | null {
  const obj = asRecord(raw);
  const code = asString(obj.code);
  const name = asString(obj.name);
  if (!code || !name) return null;

  const menuRaw = obj.menu;
  const menu = menuRaw === undefined || menuRaw === null ? null : normalizeStorefrontNavigationMenu(menuRaw);

  return {
    code,
    name,
    menu,
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

export async function getPage(slug: string, lang?: string): Promise<AdminPage | null> {
  const cleanSlug = slug.startsWith("/") ? slug.slice(1) : slug;
  const url = new URL(apiJoin(`pages/${encodeURIComponent(cleanSlug)}`));
  if (lang) url.searchParams.set("lang", lang);
  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch page: ${res.status}`);
  const payload = await res.json();
  return normalizeAdminPage(payload);
}

export async function getStorefrontNavigationLocation(code: string, lang?: string): Promise<StorefrontNavigationLocation | null> {
  const url = new URL(apiJoin(`navigation/location/${encodeURIComponent(code)}`));
  if (lang) url.searchParams.set("lang", lang);
  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch navigation location: ${res.status}`);
  const payload = await res.json();
  return normalizeStorefrontNavigationLocation(payload);
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

  // Only treat as IP block when the backend explicitly signals it via the
  // X-Blocked-Redirect header. Other 403s (CSRF mismatch, account disabled,
  // etc.) must not redirect to /blocked.
  const headerRedirect = res.headers.get("X-Blocked-Redirect");
  if (!headerRedirect) return;

  let redirectTo = headerRedirect;
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
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch admin categories: ${res.status}`);
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: itemsRaw.map(normalizeAdminCategory).filter((item): item is AdminCategory => item !== null),
  };
}

// Pages
export async function getAdminPages(params: { query?: string; status?: string; limit?: number; offset?: number } = {}): Promise<AdminPageListResponse> {
  const url = new URL(apiJoin("admin/pages"));
  if (params.query) url.searchParams.set("query", params.query);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.offset) url.searchParams.set("offset", String(params.offset));

  const res = await fetch(url.toString(), {
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch admin pages: ${res.status}`);
  const payload = asRecord(await res.json());
  const pagesRaw = Array.isArray(payload.pages) ? payload.pages : [];
  return {
    pages: pagesRaw.map(normalizeAdminPage).filter((p): p is AdminPage => p !== null),
    total: asNumber(payload.total),
  };
}

export async function getAdminPage(id: string): Promise<AdminPage> {
  const url = apiJoin(`admin/pages/${encodeURIComponent(id)}`);
  const res = await fetch(url, {
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch admin page: ${res.status}`);
  const payload = await res.json();
  const page = normalizeAdminPage(payload);
  if (!page) throw new Error("Invalid page data");
  return page;
}

export async function createAdminPage(data: Partial<AdminPage>): Promise<AdminPage> {
  const url = apiJoin("admin/pages");
  const res = await fetch(url, {
    method: "POST",
    ...(await adminMutationHeaders()),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to create page"));
  const payload = await res.json();
  const page = normalizeAdminPage(payload);
  if (!page) throw new Error("Invalid page data");
  return page;
}

export async function updateAdminPage(id: string, data: Partial<AdminPage>): Promise<AdminPage> {
  const url = apiJoin(`admin/pages/${encodeURIComponent(id)}`);
  const res = await fetch(url, {
    method: "PUT",
    ...(await adminMutationHeaders()),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to update page"));
  const payload = await res.json();
  const page = normalizeAdminPage(payload);
  if (!page) throw new Error("Invalid page data");
  return page;
}

export async function deleteAdminPage(id: string): Promise<void> {
  const url = apiJoin(`admin/pages/${encodeURIComponent(id)}`);
  const res = await fetch(url, {
    method: "DELETE",
    ...(await adminMutationHeaders()),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to delete page"));
}

export async function checkAdminPageSlug(slug: string, excludeId?: string): Promise<{ available: boolean }> {
  const url = new URL(apiJoin("admin/pages/check-slug"));
  url.searchParams.set("slug", slug);
  if (excludeId) url.searchParams.set("excludeId", excludeId);

  const res = await fetch(url.toString(), {
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to check slug: ${res.status}`);
  return await res.json();
}

// Navigation (legacy list endpoint kept for compatibility)
export async function getAdminNavigation(): Promise<{ items: AdminNavigationItem[] }> {
  const url = apiJoin("admin/navigation");
  const res = await fetch(url, {
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch admin navigation: ${res.status}`);
  const payload = await res.json();
  const itemsRaw = Array.isArray(payload) ? payload : ((asRecord(payload).items as unknown[]) || []);
  return {
    items: itemsRaw.map(normalizeAdminNavigationItem).filter((item): item is AdminNavigationItem => item !== null),
  };
}

// Navigation menus
export async function getAdminNavigationMenus(): Promise<{ menus: AdminNavigationMenu[] }> {
  const url = apiJoin("admin/navigation/menus");
  const res = await fetch(url, {
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch admin navigation menus: ${res.status}`);
  const payload = await res.json();
  const menusRaw = Array.isArray(payload) ? payload : ((asRecord(payload).menus as unknown[]) || []);
  return {
    menus: menusRaw.map(normalizeAdminNavigationMenu).filter((menu): menu is AdminNavigationMenu => menu !== null),
  };
}

export async function createAdminNavigationMenu(data: {
  code: string;
  name: string;
  description?: string | null;
}): Promise<AdminNavigationMenu> {
  const url = apiJoin("admin/navigation/menus");
  const res = await fetch(url, {
    method: "POST",
    ...(await adminMutationHeaders()),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to create navigation menu"));
  const payload = await res.json();
  const menu = normalizeAdminNavigationMenu(payload);
  if (!menu) throw new Error("Invalid navigation menu data");
  return menu;
}

export async function updateAdminNavigationMenu(
  id: string,
  data: { code: string; name: string; description?: string | null },
): Promise<AdminNavigationMenu> {
  const url = apiJoin(`admin/navigation/menus/${encodeURIComponent(id)}`);
  const res = await fetch(url, {
    method: "PUT",
    ...(await adminMutationHeaders()),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to update navigation menu"));
  const payload = await res.json();
  const menu = normalizeAdminNavigationMenu(payload);
  if (!menu) throw new Error("Invalid navigation menu data");
  return menu;
}

export async function deleteAdminNavigationMenu(id: string): Promise<void> {
  const url = apiJoin(`admin/navigation/menus/${encodeURIComponent(id)}`);
  const res = await fetch(url, {
    method: "DELETE",
    ...(await adminMutationHeaders()),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to delete navigation menu"));
}

// Navigation menu items
export async function getAdminNavigationMenuItems(menuID: string): Promise<{ items: AdminNavigationItem[] }> {
  const url = apiJoin(`admin/navigation/menus/${encodeURIComponent(menuID)}/items`);
  const res = await fetch(url, {
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch admin navigation items: ${res.status}`);
  const payload = await res.json();
  const itemsRaw = Array.isArray(payload) ? payload : ((asRecord(payload).items as unknown[]) || []);
  return {
    items: itemsRaw.map(normalizeAdminNavigationItem).filter((item): item is AdminNavigationItem => item !== null),
  };
}

export async function createAdminNavigationMenuItem(
  menuID: string,
  data: {
    label: string;
    label_i18n?: Record<string, string>;
    type: AdminNavigationItem["type"];
    page_id?: string | null;
    category_id?: string | null;
    url?: string | null;
    open_in_new_tab: boolean;
    sort_order: number;
    is_active: boolean;
  },
): Promise<AdminNavigationItem> {
  const url = apiJoin(`admin/navigation/menus/${encodeURIComponent(menuID)}/items`);
  const res = await fetch(url, {
    method: "POST",
    ...(await adminMutationHeaders()),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to create navigation item"));
  const payload = await res.json();
  const item = normalizeAdminNavigationItem(payload);
  if (!item) throw new Error("Invalid navigation item data");
  return item;
}

export async function updateAdminNavigationItem(
  id: string,
  data: {
    menu_id?: string | null;
    label: string;
    label_i18n?: Record<string, string>;
    type: AdminNavigationItem["type"];
    page_id?: string | null;
    category_id?: string | null;
    url?: string | null;
    open_in_new_tab: boolean;
    sort_order: number;
    is_active: boolean;
  },
): Promise<AdminNavigationItem> {
  const body: Record<string, unknown> = {
    label: data.label,
    label_i18n: data.label_i18n,
    type: data.type,
    page_id: data.page_id ?? null,
    category_id: data.category_id ?? null,
    url: data.url ?? null,
    open_in_new_tab: data.open_in_new_tab,
    sort_order: data.sort_order,
    is_active: data.is_active,
  };
  if (data.menu_id && data.menu_id.trim().length > 0) {
    body.menu_id = data.menu_id;
  }

  const url = apiJoin(`admin/navigation/items/${encodeURIComponent(id)}`);
  const res = await fetch(url, {
    method: "PUT",
    ...(await adminMutationHeaders()),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to update navigation item"));
  const payload = await res.json();
  const item = normalizeAdminNavigationItem(payload);
  if (!item) throw new Error("Invalid navigation item data");
  return item;
}

export async function deleteAdminNavigationItem(id: string): Promise<void> {
  const url = apiJoin(`admin/navigation/items/${encodeURIComponent(id)}`);
  const res = await fetch(url, {
    method: "DELETE",
    ...(await adminMutationHeaders()),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to delete navigation item"));
}

export async function reorderAdminNavigationMenuItems(menuID: string, itemIDs: string[]): Promise<void> {
  const url = apiJoin(`admin/navigation/menus/${encodeURIComponent(menuID)}/reorder`);
  const res = await fetch(url, {
    method: "PUT",
    ...(await adminMutationHeaders()),
    body: JSON.stringify({ item_ids: itemIDs }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to reorder navigation items"));
}

// Navigation locations
export async function getAdminNavigationLocations(): Promise<{ locations: AdminNavigationLocation[] }> {
  const url = apiJoin("admin/navigation/locations");
  const res = await fetch(url, {
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch admin navigation locations: ${res.status}`);
  const payload = await res.json();
  const locationsRaw = Array.isArray(payload) ? payload : ((asRecord(payload).locations as unknown[]) || []);
  return {
    locations: locationsRaw
      .map(normalizeAdminNavigationLocation)
      .filter((location): location is AdminNavigationLocation => location !== null),
  };
}

export async function assignAdminNavigationLocation(code: string, menuID: string | null): Promise<void> {
  const url = apiJoin(`admin/navigation/locations/${encodeURIComponent(code)}`);
  const res = await fetch(url, {
    method: "PUT",
    ...(await adminMutationHeaders()),
    body: JSON.stringify({ menu_id: menuID }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to assign navigation location"));
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

  const doFetch = () => {
    const h: Record<string, string> = {};
    const csrf = getCSRFToken();
    if (csrf) h["X-CSRF-Token"] = csrf;
    return fetch(url.toString(), { method: "POST", headers: h, credentials: "include" });
  };

  // On the very first visit no csrf_token cookie exists yet; the 403 response
  // sets the cookie so a single retry is enough to bootstrap.
  const hadToken = !!getCSRFToken();
  let res = await doFetch();

  if (res.status === 403 && !hadToken && getCSRFToken()) {
    res = await doFetch();
  }

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
    headers: mutHeaders(),
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
    headers: mutHeaders(),
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
  const csrfHeaders: Record<string, string> = {};
  const csrf = getCSRFToken();
  if (csrf) csrfHeaders["X-CSRF-Token"] = csrf;
  const res = await fetch(url.toString(), { method: "DELETE", headers: csrfHeaders, credentials: "include" });
  if (!res.ok) {
    await throwBlockedIPErrorIfNeeded(res);
    throw new Error(`Failed to remove item: ${res.status}`);
  }
  return res.json();
}

export async function checkout(): Promise<{ order_id: string; checkout_url: string; status: string }> {
  const url = new URL(apiJoin("checkout"));
  const csrfHeaders: Record<string, string> = {};
  const csrf = getCSRFToken();
  if (csrf) csrfHeaders["X-CSRF-Token"] = csrf;
  const res = await fetch(url.toString(), { method: "POST", headers: csrfHeaders, credentials: "include" });
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

export type AccountOrderDetailItem = {
  id: string;
  product_title: string;
  variant_sku: string;
  quantity: number;
  unit_price_cents: number;
  currency: string;
  custom_options: unknown[];
};

export type AccountOrderBankConfig = {
  account_name: string;
  account_number: string;
  bank_name: string;
  iban: string;
  bic_swift: string;
  sort_code: string;
};

export type AccountOrderPayment = {
  method: string;
  provider: string;
  title: string;
  description: string;
  instructions: string;
  bank_config: AccountOrderBankConfig | null;
};

export type AccountOrderShipping = {
  method_title: string;
  full_name: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  terminal_name: string;
  terminal_address: string;
};

export type AccountOrderDetail = {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  created_at: string;
  items: AccountOrderDetailItem[];
  shipping: AccountOrderShipping;
  payment: AccountOrderPayment;
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

function normalizeAccountOrderDetailItem(raw: unknown): AccountOrderDetailItem | null {
  const obj = asRecord(raw);
  const id = asString(obj.id ?? obj.ID);
  if (!id) return null;
  const maybeOpts = obj.custom_options ?? obj.CustomOptions;
  return {
    id,
    product_title: asString(obj.product_title ?? obj.ProductTitle),
    variant_sku: asString(obj.variant_sku ?? obj.VariantSKU),
    quantity: asNumber(obj.quantity ?? obj.Quantity),
    unit_price_cents: asNumber(obj.unit_price_cents ?? obj.UnitPriceCents),
    currency: asString(obj.currency ?? obj.Currency),
    custom_options: Array.isArray(maybeOpts) ? maybeOpts : [],
  };
}

function normalizeAccountOrderDetail(raw: unknown): AccountOrderDetail {
  const obj = asRecord(raw);
  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
  const shippingRaw = asRecord(obj.shipping);
  const paymentRaw = asRecord(obj.payment);
  const bankRaw = paymentRaw.bank_config != null ? asRecord(paymentRaw.bank_config) : null;
  return {
    id: asString(obj.id),
    number: asString(obj.number),
    status: asString(obj.status),
    currency: asString(obj.currency),
    subtotal_cents: asNumber(obj.subtotal_cents),
    shipping_cents: asNumber(obj.shipping_cents),
    tax_cents: asNumber(obj.tax_cents),
    total_cents: asNumber(obj.total_cents),
    created_at: asString(obj.created_at),
    items: itemsRaw.map(normalizeAccountOrderDetailItem).filter((item): item is AccountOrderDetailItem => item !== null),
    shipping: {
      method_title: asString(shippingRaw.method_title),
      full_name: asString(shippingRaw.full_name),
      phone: asString(shippingRaw.phone),
      address1: asString(shippingRaw.address1),
      address2: asString(shippingRaw.address2),
      city: asString(shippingRaw.city),
      state: asString(shippingRaw.state),
      postcode: asString(shippingRaw.postcode),
      country: asString(shippingRaw.country),
      terminal_name: asString(shippingRaw.terminal_name),
      terminal_address: asString(shippingRaw.terminal_address),
    },
    payment: {
      method: asString(paymentRaw.method),
      provider: asString(paymentRaw.provider),
      title: asString(paymentRaw.title),
      description: asString(paymentRaw.description),
      instructions: asString(paymentRaw.instructions),
      bank_config: bankRaw
        ? {
            account_name: asString(bankRaw.account_name),
            account_number: asString(bankRaw.account_number),
            bank_name: asString(bankRaw.bank_name),
            iban: asString(bankRaw.iban),
            bic_swift: asString(bankRaw.bic_swift),
            sort_code: asString(bankRaw.sort_code),
          }
        : null,
    },
  };
}

export async function registerAccount(email: string, password: string, options?: AccountRequestOptions): Promise<AccountCustomer> {
  const res = await fetch(
    apiJoin("auth/register"),
    accountFetchInit(
      {
        method: "POST",
        headers: mutHeaders(),
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
        headers: mutHeaders(),
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
  const csrfHeaders: Record<string, string> = {};
  const csrf = getCSRFToken();
  if (csrf) csrfHeaders["X-CSRF-Token"] = csrf;
  const res = await fetch(
    apiJoin("auth/logout"),
    accountFetchInit(
      {
        method: "POST",
        headers: csrfHeaders,
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
        headers: mutHeaders(),
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
  const csrfHeaders: Record<string, string> = {};
  const csrf = getCSRFToken();
  if (csrf) csrfHeaders["X-CSRF-Token"] = csrf;
  const res = await fetch(
    apiJoin(`account/favorites/${encodeURIComponent(productID)}`),
    accountFetchInit(
      {
        method: "DELETE",
        headers: csrfHeaders,
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

export async function getAccountOrder(id: string, options?: AccountRequestOptions): Promise<AccountOrderDetail> {
  const res = await fetch(
    apiJoin(`account/orders/${encodeURIComponent(id)}`),
    accountFetchInit({ method: "GET" }, options),
  );
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (!res.ok) throw new Error(await apiErrorMessage(res, `Failed to load order: ${res.status}`));
  return normalizeAccountOrderDetail(await res.json());
}

export async function changeAccountPassword(currentPassword: string, newPassword: string, options?: AccountRequestOptions): Promise<void> {
  const res = await fetch(
    apiJoin("account/change-password"),
    accountFetchInit(
      {
        method: "POST",
        headers: mutHeaders(),
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
    headers: mutHeaders(),
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
  customer_name: string;
  customer_info: string;
  shipment_type: string;
  payment_type: string;
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
  id: string;
  order_id: string;
  product_variant_id: string;
  unit_price_cents: number;
  currency: string;
  quantity: number;
  product_title: string;
  variant_sku: string;
  variant_attributes_json: Record<string, string | number | boolean | null>;
  custom_options_json: AdminOrderItemCustomOption[];
  created_at: string;
  updated_at: string;
};

export type AdminOrderItemCustomOption = {
  option_id: string;
  title: string;
  type: string;
  value_id: string;
  value_ids: string[];
  value_text: string;
  value_title: string;
  value_titles: string[];
  price_delta_cents: number;
};

export type AdminOrderCore = {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  created_at: string;
  updated_at: string;
};

export type AdminOrderCustomer = {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
};

export type AdminOrderShipping = {
  method_id: string;
  method_title: string;
  provider_key: string;
  service_code: string;
  terminal_id: string;
  terminal_name: string;
  terminal_address: string;
  price_cents: number;
  full_name: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
};

export type AdminOrderBilling = {
  full_name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  company_name: string;
  company_vat: string;
  invoice_email: string;
};

export type AdminOrderPayment = {
  method: string;
  provider: string;
};

export type AdminOrderDetail = {
  order: AdminOrderCore;
  customer: AdminOrderCustomer;
  shipping: AdminOrderShipping;
  billing: AdminOrderBilling;
  payment: AdminOrderPayment;
  items: AdminOrderDetailItem[];
};

function normalizeAdminOrderCustomOption(raw: unknown): AdminOrderItemCustomOption | null {
  const obj = asRecord(raw);
  const title = asString(obj.title);
  const type = asString(obj.type);
  if (!title && !type) return null;

  const valueIDsRaw = Array.isArray(obj.value_ids) ? obj.value_ids : [];
  const valueTitlesRaw = Array.isArray(obj.value_titles) ? obj.value_titles : [];
  return {
    option_id: asString(obj.option_id),
    title,
    type,
    value_id: asString(obj.value_id),
    value_ids: valueIDsRaw.map((value) => asString(value)).filter((value) => value.length > 0),
    value_text: asString(obj.value_text),
    value_title: asString(obj.value_title),
    value_titles: valueTitlesRaw.map((value) => asString(value)).filter((value) => value.length > 0),
    price_delta_cents: asNumber(obj.price_delta_cents),
  };
}

function normalizeAdminOrderVariantAttributes(raw: unknown): Record<string, string | number | boolean | null> {
  const obj = asRecord(raw);
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      out[key] = value;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

function normalizeAdminOrderDetailItem(raw: unknown): AdminOrderDetailItem | null {
  const obj = asRecord(raw);
  const id = asString(obj.id ?? obj.ID);
  if (!id) return null;

  const customOptionsRaw = Array.isArray(obj.custom_options_json) ? obj.custom_options_json : [];
  return {
    id,
    order_id: asString(obj.order_id ?? obj.OrderID),
    product_variant_id: asString(obj.product_variant_id ?? obj.ProductVariantID),
    unit_price_cents: asNumber(obj.unit_price_cents ?? obj.UnitPriceCents),
    currency: asString(obj.currency ?? obj.Currency),
    quantity: asNumber(obj.quantity ?? obj.Quantity),
    product_title: asString(obj.product_title ?? obj.ProductTitle),
    variant_sku: asString(obj.variant_sku ?? obj.VariantSKU),
    variant_attributes_json: normalizeAdminOrderVariantAttributes(obj.variant_attributes_json),
    custom_options_json: customOptionsRaw
      .map(normalizeAdminOrderCustomOption)
      .filter((option): option is AdminOrderItemCustomOption => option !== null),
    created_at: asString(obj.created_at ?? obj.CreatedAt),
    updated_at: asString(obj.updated_at ?? obj.UpdatedAt),
  };
}

function normalizeAdminOrderDetail(raw: unknown): AdminOrderDetail {
  const obj = asRecord(raw);
  const rawItems = obj.items ?? obj.Items;
  const itemsRaw: unknown[] = Array.isArray(rawItems) ? rawItems : [];

  // Backward compatibility with legacy response shape.
  if (obj.order === undefined && (obj.ID !== undefined || obj.id !== undefined)) {
    return {
      order: {
        id: asString(obj.id ?? obj.ID),
        number: asString(obj.number ?? obj.Number),
        status: asString(obj.status ?? obj.Status),
        currency: asString(obj.currency ?? obj.Currency),
        subtotal_cents: asNumber(obj.subtotal_cents ?? obj.SubtotalCents),
        shipping_cents: asNumber(obj.shipping_cents ?? obj.ShippingCents),
        tax_cents: asNumber(obj.tax_cents ?? obj.TaxCents),
        total_cents: asNumber(obj.total_cents ?? obj.TotalCents),
        created_at: asString(obj.created_at ?? obj.CreatedAt),
        updated_at: asString(obj.updated_at ?? obj.UpdatedAt),
      },
      customer: {
        id: "",
        email: "",
        phone: "",
        first_name: "",
        last_name: "",
      },
      shipping: {
        method_id: "",
        method_title: "",
        provider_key: "",
        service_code: "",
        terminal_id: "",
        terminal_name: "",
        terminal_address: "",
        price_cents: asNumber(obj.shipping_cents ?? obj.ShippingCents),
        full_name: "",
        phone: "",
        address1: "",
        address2: "",
        city: "",
        state: "",
        postcode: "",
        country: "",
      },
      billing: {
        full_name: "",
        address1: "",
        address2: "",
        city: "",
        state: "",
        postcode: "",
        country: "",
        company_name: "",
        company_vat: "",
        invoice_email: "",
      },
      payment: {
        method: "",
        provider: "",
      },
      items: itemsRaw.map(normalizeAdminOrderDetailItem).filter((item): item is AdminOrderDetailItem => item !== null),
    };
  }

  const orderObj = asRecord(obj.order);
  const customerObj = asRecord(obj.customer);
  const shippingObj = asRecord(obj.shipping);
  const billingObj = asRecord(obj.billing);
  const paymentObj = asRecord(obj.payment);
  return {
    order: {
      id: asString(orderObj.id),
      number: asString(orderObj.number),
      status: asString(orderObj.status),
      currency: asString(orderObj.currency),
      subtotal_cents: asNumber(orderObj.subtotal_cents),
      shipping_cents: asNumber(orderObj.shipping_cents),
      tax_cents: asNumber(orderObj.tax_cents),
      total_cents: asNumber(orderObj.total_cents),
      created_at: asString(orderObj.created_at),
      updated_at: asString(orderObj.updated_at),
    },
    customer: {
      id: asString(customerObj.id),
      email: asString(customerObj.email),
      phone: asString(customerObj.phone),
      first_name: asString(customerObj.first_name),
      last_name: asString(customerObj.last_name),
    },
    shipping: {
      method_id: asString(shippingObj.method_id),
      method_title: asString(shippingObj.method_title),
      provider_key: asString(shippingObj.provider_key),
      service_code: asString(shippingObj.service_code),
      terminal_id: asString(shippingObj.terminal_id),
      terminal_name: asString(shippingObj.terminal_name),
      terminal_address: asString(shippingObj.terminal_address),
      price_cents: asNumber(shippingObj.price_cents),
      full_name: asString(shippingObj.full_name),
      phone: asString(shippingObj.phone),
      address1: asString(shippingObj.address1),
      address2: asString(shippingObj.address2),
      city: asString(shippingObj.city),
      state: asString(shippingObj.state),
      postcode: asString(shippingObj.postcode),
      country: asString(shippingObj.country),
    },
    billing: {
      full_name: asString(billingObj.full_name),
      address1: asString(billingObj.address1),
      address2: asString(billingObj.address2),
      city: asString(billingObj.city),
      state: asString(billingObj.state),
      postcode: asString(billingObj.postcode),
      country: asString(billingObj.country),
      company_name: asString(billingObj.company_name),
      company_vat: asString(billingObj.company_vat),
      invoice_email: asString(billingObj.invoice_email),
    },
    payment: {
      method: asString(paymentObj.method),
      provider: asString(paymentObj.provider),
    },
    items: itemsRaw.map(normalizeAdminOrderDetailItem).filter((item): item is AdminOrderDetailItem => item !== null),
  };
}

export async function getAdminOrders(params: { page?: number; limit?: number } = {}): Promise<{ items: AdminOrderSummary[]; page: number; limit: number; }> {
  const url = new URL(apiJoin("admin/orders"));
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), {
    ...(await adminRequestHeaders()),
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
    ...(await adminRequestHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminRequestHeaders()),
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
    ...(await adminRequestHeaders()),
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
    ...(await adminRequestHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch dashboard: ${res.status}`);
  return res.json();
}

export async function getAdminOrder(id: string): Promise<AdminOrderDetail> {
  const url = new URL(apiJoin(`admin/orders/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch order: ${res.status}`);
  return normalizeAdminOrderDetail(await res.json());
}

export async function updateAdminOrderStatus(orderID: string, status: string): Promise<{ status: string }> {
  const url = new URL(apiJoin("admin/orders/status"));
  const res = await fetch(url.toString(), {
    method: "POST",
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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

export async function getAdminMedia(params: { limit?: number; offset?: number; media_type?: "image" | "video" } = {}): Promise<AdminMediaListResponse> {
  const url = new URL(apiJoin("admin/media"));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.offset) url.searchParams.set("offset", String(params.offset));
  if (params.media_type) url.searchParams.set("media_type", params.media_type);

  const res = await fetch(url.toString(), {
    ...(await adminRequestHeaders()),
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
    ...(await adminMutationHeaders({}, false)),
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

export async function uploadAdminVideo(file: File, alt: string): Promise<AdminMediaAsset> {
  if (!file || file.size <= 0) throw new Error("Video file is required");
  const form = new FormData();
  form.set("file", file);
  const normalizedAlt = alt.trim();
  if (normalizedAlt) form.set("alt", normalizedAlt);
  const url = new URL(apiJoin("admin/media/video/upload"));
  const res = await fetch(url.toString(), {
    method: "POST",
    ...(await adminMutationHeaders({}, false)),
    cache: "no-store",
    body: form,
  });
  if (!res.ok) {
    let detail = `Video upload failed: ${res.status}`;
    try {
      const payload = asRecord(await res.json());
      const errorMessage = asString(payload.error);
      if (errorMessage) detail = `${detail} (${errorMessage})`;
    } catch {}
    throw new Error(detail);
  }
  const normalized = normalizeAdminMediaAsset(await res.json());
  if (!normalized) throw new Error("Video upload failed: invalid response");
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminRequestHeaders()),
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
    ...(await adminRequestHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminRequestHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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

export async function deleteAdminMedia(id: string): Promise<void> {
  const res = await fetch(
    new URL(apiJoin(`admin/media/${encodeURIComponent(id)}`)).toString(),
    { method: "DELETE", ...(await adminMutationHeaders()), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Delete media failed: ${res.status}`);
}

export async function addAdminProductImage(productID: string, url: string, alt: string): Promise<ProductImage> {
  const out = await adminCatalogRequest<unknown>({
    path: `admin/catalog/products/${encodeURIComponent(productID)}/images`,
    method: "POST",
    body: { url, alt },
  });
  const obj = asRecord(out);
  return {
    id: asString(obj.id),
    url: asString(obj.url),
    alt: asString(obj.alt),
    sort: asNumber(obj.sort),
    isDefault: Boolean(obj.isDefault ?? obj.is_default),
  };
}

export async function removeAdminProductImage(productID: string, imageID: string): Promise<void> {
  const res = await fetch(
    new URL(apiJoin(`admin/catalog/products/${encodeURIComponent(productID)}/images/${encodeURIComponent(imageID)}`)).toString(),
    { method: "DELETE", ...(await adminMutationHeaders()), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Remove image failed: ${res.status}`);
}

export async function setDefaultAdminProductImage(productID: string, imageID: string): Promise<void> {
  const res = await fetch(
    new URL(apiJoin(`admin/catalog/products/${encodeURIComponent(productID)}/images/${encodeURIComponent(imageID)}/default`)).toString(),
    { method: "PATCH", ...(await adminMutationHeaders()), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Set default image failed: ${res.status}`);
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
  pricing_mode: "flat" | "free" | "total_tiers" | "weight_tiers" | "provider";
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
  const id = asString(obj.id ?? obj.ID);
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

  const pricingModeRaw = asString(obj.pricing_mode ?? obj.pricingMode).toLowerCase();
  const pricingMode = pricingModeRaw === "fixed"
    ? "flat"
    : pricingModeRaw === "table"
      ? "weight_tiers"
      : pricingModeRaw;
  if (pricingMode !== "flat" && pricingMode !== "free" && pricingMode !== "total_tiers" && pricingMode !== "weight_tiers" && pricingMode !== "provider") {
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
    pricing_mode: pricingMode as ShippingMethod["pricing_mode"],
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
    ...(await adminRequestHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to delete shipping provider: ${res.status}`));
  }
}

export type TestProviderResult = {
  success: boolean;
  message: string;
  error?: string;
  terminals_found?: number;
  provider?: string;
  name?: string;
};

export async function testShippingProvider(
  key: string,
  configJson: Record<string, unknown>,
  mode: "sandbox" | "live"
): Promise<TestProviderResult> {
  const url = new URL(apiJoin(`admin/shipping/providers/${encodeURIComponent(key)}/test`));
  const res = await fetch(url.toString(), {
    method: "POST",
    ...(await adminMutationHeaders()),
    cache: "no-store",
    body: JSON.stringify({
      config_json: configJson,
      mode,
    }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to test shipping provider: ${res.status}`));
  }
  return res.json();
}

export async function getShippingZones(): Promise<ShippingZone[]> {
  const url = new URL(apiJoin("admin/shipping/zones"));
  const res = await fetch(url.toString(), {
    ...(await adminRequestHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to delete shipping zone: ${res.status}`));
  }
}

export async function getShippingMethods(): Promise<ShippingMethod[]> {
  const url = new URL(apiJoin("admin/shipping/methods"));
  const res = await fetch(url.toString(), {
    ...(await adminRequestHeaders()),
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
    pricing_mode: data.pricing_mode || "flat",
    pricing_rules_json: data.pricing_rules_json || {},
  };
  const res = await fetch(url.toString(), {
    method: "POST",
    ...(await adminMutationHeaders()),
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
    pricing_mode: data.pricing_mode || "flat",
    pricing_rules_json: data.pricing_rules_json || {},
  };
  const res = await fetch(url.toString(), {
    method: "PUT",
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
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
    ...(await adminMutationHeaders()),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to delete shipping terminals: ${res.status}`));
  }
}

export type PaymentMethod = {
  id: string;
  key: string;
  method_name: "bank_transfer" | "cash_on_delivery";
  title: string;
  description: string;
  instructions: string;
  enabled: boolean;
  payment_type: "manual" | "provider";
  config_json: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BankTransferConfig = {
  account_name: string;
  account_number: string;
  bank_name: string;
  sort_code?: string;
  iban?: string;
  bic_swift?: string;
};

export type CashOnDeliveryConfig = {
  shipping_method_ids: string[];
  accept_virtual_orders: boolean;
};

function normalizePaymentMethod(raw: unknown): PaymentMethod | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  if (!id) return null;

  const paymentType = asString(obj.payment_type ?? obj.paymentType).toLowerCase();
  if (paymentType !== "manual" && paymentType !== "provider") return null;

  const methodName = asString(obj.method_name ?? obj.methodName).toLowerCase();
  if (methodName !== "bank_transfer" && methodName !== "cash_on_delivery") return null;

  return {
    id,
    key: asString(obj.key),
    method_name: methodName as "bank_transfer" | "cash_on_delivery",
    title: asString(obj.title),
    description: asString(obj.description),
    instructions: asString(obj.instructions),
    enabled: asBoolean(obj.enabled),
    payment_type: paymentType as "manual" | "provider",
    config_json: asRecord(obj.config_json ?? obj.configJSON),
    sort_order: asNumber(obj.sort_order ?? obj.sortOrder),
    created_at: asString(obj.created_at ?? obj.createdAt),
    updated_at: asString(obj.updated_at ?? obj.updatedAt),
  };
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const url = new URL(apiJoin("admin/payments/methods"));
  const res = await fetch(url.toString(), {
    ...(await adminRequestHeaders()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch payment methods: ${res.status}`);
  const payload = asRecord(await res.json());
  const itemsRaw = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.methods)
      ? payload.methods
      : [];
  return itemsRaw.map(normalizePaymentMethod).filter((item): item is PaymentMethod => item !== null);
}

export async function createPaymentMethod(data: Omit<PaymentMethod, "id" | "created_at" | "updated_at">): Promise<PaymentMethod> {
  const url = new URL(apiJoin("admin/payments/methods"));
  const payload = {
    key: data.key || "",
    method_name: data.method_name || "",
    title: data.title || "",
    description: data.description || "",
    instructions: data.instructions || "",
    enabled: data.enabled !== undefined ? data.enabled : false,
    payment_type: data.payment_type || "manual",
    config_json: data.config_json || {},
    sort_order: data.sort_order || 0,
  };
  const res = await fetch(url.toString(), {
    method: "POST",
    ...(await adminMutationHeaders()),
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to create payment method: ${res.status}`));
  }
  const normalized = normalizePaymentMethod(await res.json());
  if (!normalized) throw new Error("Failed to create payment method: invalid response");
  return normalized;
}

export async function updatePaymentMethod(id: string, data: Partial<PaymentMethod>): Promise<PaymentMethod> {
  const url = new URL(apiJoin(`admin/payments/methods/${encodeURIComponent(id)}`));
  const payload = {
    key: data.key || "",
    method_name: data.method_name || "",
    title: data.title || "",
    description: data.description || "",
    instructions: data.instructions || "",
    enabled: data.enabled !== undefined ? data.enabled : false,
    payment_type: data.payment_type || "manual",
    config_json: data.config_json || {},
    sort_order: data.sort_order || 0,
  };
  const res = await fetch(url.toString(), {
    method: "PUT",
    ...(await adminMutationHeaders()),
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to update payment method: ${res.status}`));
  }
  const normalized = normalizePaymentMethod(await res.json());
  if (!normalized) throw new Error("Failed to update payment method: invalid response");
  return normalized;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const url = new URL(apiJoin(`admin/payments/methods/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    ...(await adminMutationHeaders()),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, `Failed to delete payment method: ${res.status}`));
  }
}

// Storefront shipping types
export type StorefrontShippingZone = {
  id: string;
  name: string;
  countries: string[];
  enabled: boolean;
};

export type StorefrontShippingMethod = {
  id: string;
  zone_id: string;
  provider_key: string;
  service_code: string;
  title: string;
  enabled: boolean;
  sort_order: number;
  pricing_mode: string;
  price: number;
  currency: string;
  requires_terminal: boolean;
};

export type StorefrontShippingOptionsResponse = {
  zone: StorefrontShippingZone | null;
  methods: StorefrontShippingMethod[];
};

export async function getStorefrontShippingOptions(params: {
  country: string;
  cart_value?: number;
  cart_weight_kg?: number;
}): Promise<StorefrontShippingOptionsResponse> {
  const url = new URL(apiJoin("shipping/options"));
  url.searchParams.set("country", params.country);
  if (params.cart_value !== undefined) {
    url.searchParams.set("cart_value", params.cart_value.toString());
  }
  if (params.cart_weight_kg !== undefined) {
    url.searchParams.set("cart_weight_kg", params.cart_weight_kg.toString());
  }
  const res = await fetch(url.toString(), {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch shipping options: ${res.status}`);
  }
  const data = await res.json();
  return {
    zone: data.zone ? {
      id: asString(data.zone.id),
      name: asString(data.zone.name),
      countries: Array.isArray(data.zone.countries) ? data.zone.countries.map(String) : [],
      enabled: Boolean(data.zone.enabled),
    } : null,
    methods: Array.isArray(data.methods) ? data.methods.map((m: unknown) => {
      const method = asRecord(m);
      return {
        id: asString(method.id),
        zone_id: asString(method.zone_id),
        provider_key: asString(method.provider_key),
        service_code: asString(method.service_code),
        title: asString(method.title),
        enabled: Boolean(method.enabled),
        sort_order: asNumber(method.sort_order ?? 0),
        pricing_mode: asString(method.pricing_mode),
        price: asNumber(method.price ?? 0),
        currency: asString(method.currency),
        requires_terminal: Boolean(method.requires_terminal),
      };
    }) : [],
  };
}
