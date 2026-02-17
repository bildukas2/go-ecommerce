export const DEFAULT_ADMIN_PRODUCTS_PAGE = 1;
export const DEFAULT_ADMIN_PRODUCTS_LIMIT = 20;
export const LOW_STOCK_THRESHOLD = 5;

const SORT_VALUES = new Set([
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
  "price_asc",
  "price_desc",
]);

const STOCK_VALUES = new Set(["all", "in_stock", "out_of_stock", "low_stock"]);

export function firstSearchParam(value) {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

export function parsePositiveIntParam(value, fallback) {
  const raw = firstSearchParam(value);
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function parseAdminProductsSearchParams(searchParams) {
  const categoryRaw = firstSearchParam(searchParams?.category) ?? "";
  const sortRaw = firstSearchParam(searchParams?.sort) ?? "newest";
  const stockRaw = firstSearchParam(searchParams?.stock) ?? "all";

  return {
    page: parsePositiveIntParam(searchParams?.page, DEFAULT_ADMIN_PRODUCTS_PAGE),
    limit: parsePositiveIntParam(searchParams?.limit, DEFAULT_ADMIN_PRODUCTS_LIMIT),
    category: categoryRaw.trim(),
    sort: SORT_VALUES.has(sortRaw) ? sortRaw : "newest",
    stock: STOCK_VALUES.has(stockRaw) ? stockRaw : "all",
  };
}

function totalStock(product) {
  if (!Array.isArray(product?.variants)) return 0;
  return product.variants.reduce((sum, variant) => {
    const stock = Number(variant?.stock ?? 0);
    if (!Number.isFinite(stock)) return sum;
    return sum + Math.max(0, stock);
  }, 0);
}

function selectedPrice(product) {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const inStockVariant = product.variants.find((variant) => Number(variant?.stock ?? 0) > 0);
  const fallbackVariant = product.variants[0];
  const selected = inStockVariant ?? fallbackVariant;
  const price = Number(selected?.priceCents ?? Number.POSITIVE_INFINITY);
  return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
}

function createdTimestamp(product) {
  const parsed = Date.parse(product?.createdAt ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function applyAdminProductsState(products, state) {
  const list = Array.isArray(products) ? [...products] : [];

  const filtered = list.filter((product) => {
    const stock = totalStock(product);

    if (state.stock === "in_stock") return stock > 0;
    if (state.stock === "out_of_stock") return stock <= 0;
    if (state.stock === "low_stock") return stock > 0 && stock <= LOW_STOCK_THRESHOLD;

    return true;
  });

  filtered.sort((a, b) => {
    if (state.sort === "name_asc") return String(a?.title ?? "").localeCompare(String(b?.title ?? ""));
    if (state.sort === "name_desc") return String(b?.title ?? "").localeCompare(String(a?.title ?? ""));
    if (state.sort === "price_asc") return selectedPrice(a) - selectedPrice(b);
    if (state.sort === "price_desc") return selectedPrice(b) - selectedPrice(a);
    if (state.sort === "oldest") return createdTimestamp(a) - createdTimestamp(b);

    return createdTimestamp(b) - createdTimestamp(a);
  });

  return filtered;
}

export function isUnauthorizedAdminError(error) {
  return hasStatusCode(error, 401);
}

function hasStatusCode(error, statusCode) {
  if (!(error instanceof Error)) return false;
  return new RegExp(`\\b${statusCode}\\b`).test(error.message);
}
