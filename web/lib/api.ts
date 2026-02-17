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
  variants: ProductVariant[];
  images: ProductImage[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProductVariant = {
  id: string;
  sku: string;
  priceCents: number;
  currency: string;
  stock: number;
  attributes: Record<string, string | number | boolean | null>;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string;
  sort: number;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  parentId?: string | null;
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

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
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
  };
}

function normalizeProduct(raw: unknown): Product {
  const obj = asRecord(raw);
  const variantsRaw = Array.isArray(obj.variants) ? obj.variants : [];
  const imagesRaw = Array.isArray(obj.images) ? obj.images : [];

  return {
    id: asString(obj.id),
    slug: asString(obj.slug),
    title: asString(obj.title),
    description: asString(obj.description),
    images: imagesRaw.map(normalizeImage).filter((img): img is ProductImage => img !== null),
    variants: variantsRaw.map(normalizeVariant).filter((variant): variant is ProductVariant => variant !== null),
    createdAt: asString(obj.createdAt ?? obj.created_at) || undefined,
    updatedAt: asString(obj.updatedAt ?? obj.updated_at) || undefined,
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
  return res.json();
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
