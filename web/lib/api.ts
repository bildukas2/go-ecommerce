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

export async function ensureCart(): Promise<void> {
  const url = new URL(apiJoin("cart"));
  const res = await fetch(url.toString(), {
    method: "POST",
    // Include credentials so API can set the HttpOnly cookie on same-origin or configured domain
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to initialize cart: ${res.status}`);
}
