import type { Product } from "./api";

export type AdminProductSort =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc";

export type AdminProductStockFilter = "all" | "in_stock" | "out_of_stock" | "low_stock";

export type AdminProductsState = {
  page: number;
  limit: number;
  category: string;
  sort: AdminProductSort;
  stock: AdminProductStockFilter;
};

export const DEFAULT_ADMIN_PRODUCTS_PAGE: number;
export const DEFAULT_ADMIN_PRODUCTS_LIMIT: number;
export const LOW_STOCK_THRESHOLD: number;

export function firstSearchParam(value: string | string[] | undefined): string | undefined;
export function parsePositiveIntParam(value: string | string[] | undefined, fallback: number): number;
export function parseAdminProductsSearchParams(searchParams: {
  page?: string | string[];
  limit?: string | string[];
  category?: string | string[];
  sort?: string | string[];
  stock?: string | string[];
} | undefined): AdminProductsState;

export function applyAdminProductsState(products: Product[], state: Pick<AdminProductsState, "sort" | "stock">): Product[];
export function isUnauthorizedAdminError(error: unknown): boolean;
