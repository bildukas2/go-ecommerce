import { API_URL } from "./config";

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
  createdAt?: string;
  updatedAt?: string;
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

export async function getProducts(params: { page?: number; limit?: number; category?: string } = {}): Promise<ProductListResponse> {
  const url = new URL(apiJoin("products"));
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.category) url.searchParams.set("category", params.category);

  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  return res.json();
}

export async function getProduct(slug: string): Promise<Product> {
  const url = new URL(apiJoin(`products/${encodeURIComponent(slug)}`));
  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Failed to fetch product: ${res.status}`);
  return res.json();
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
  return res.json();
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

export async function getAdminOrder(id: string): Promise<AdminOrderDetail> {
  const url = new URL(apiJoin(`admin/orders/${encodeURIComponent(id)}`));
  const res = await fetch(url.toString(), {
    headers: { Authorization: adminAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch order: ${res.status}`);
  return res.json();
}
