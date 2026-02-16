import { API_URL } from "./config";

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
  const url = new URL("/products", API_URL);
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.category) url.searchParams.set("category", params.category);

  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  return res.json();
}

export async function getProduct(slug: string): Promise<Product> {
  const url = new URL(`/products/${encodeURIComponent(slug)}`, API_URL);
  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Failed to fetch product: ${res.status}`);
  return res.json();
}

export async function getCategories(): Promise<{ items: Category[] }> {
  const url = new URL("/categories", API_URL);
  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}

export async function ensureCart(): Promise<void> {
  const url = new URL("/cart", API_URL);
  const res = await fetch(url.toString(), {
    method: "POST",
    // Include credentials so API can set the HttpOnly cookie on same-origin or configured domain
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to initialize cart: ${res.status}`);
}
