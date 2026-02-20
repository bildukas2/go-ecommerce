export const DEFAULT_ADMIN_PRODUCTS_PAGE = 1;
export const DEFAULT_ADMIN_PRODUCTS_LIMIT = 20;
export const LOW_STOCK_THRESHOLD = 5;
const DISCOUNT_MODE_VALUES = new Set(["price", "percent"]);

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

export function normalizeSelectedProductIDs(productIDs) {
  if (!Array.isArray(productIDs)) return [];
  const seen = new Set();
  const out = [];
  for (const value of productIDs) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function isEveryProductSelected(productIDs, selectedProductIDs) {
  const all = normalizeSelectedProductIDs(productIDs);
  const selectedSet = new Set(normalizeSelectedProductIDs(selectedProductIDs));
  return all.length > 0 && all.every((id) => selectedSet.has(id));
}

export function toggleProductSelection(selectedProductIDs, productID, checked) {
  const selected = normalizeSelectedProductIDs(selectedProductIDs);
  const id = typeof productID === "string" ? productID.trim() : "";
  if (!id) return selected;
  const set = new Set(selected);
  if (checked) {
    set.add(id);
  } else {
    set.delete(id);
  }
  return [...set];
}

export function parseDiscountDraft(inputMode, inputValue) {
  const mode = typeof inputMode === "string" && DISCOUNT_MODE_VALUES.has(inputMode) ? inputMode : "percent";
  const parsedValue = Number.parseFloat(String(inputValue ?? ""));
  const value = Number.isFinite(parsedValue) ? parsedValue : 0;
  return { mode, value };
}

export function calculateDiscountPreview(basePriceCents, mode, value) {
  const base = Number(basePriceCents);
  if (!Number.isFinite(base) || base <= 0) {
    return {
      valid: false,
      discountedPriceCents: null,
      savingsCents: null,
      percentOff: null,
    };
  }
  if (mode === "price") {
    const discounted = Math.round(value);
    if (!Number.isFinite(discounted) || discounted < 0 || discounted >= base) {
      return { valid: false, discountedPriceCents: null, savingsCents: null, percentOff: null };
    }
    const savings = base - discounted;
    return {
      valid: true,
      discountedPriceCents: discounted,
      savingsCents: savings,
      percentOff: Math.round((savings / base) * 10000) / 100,
    };
  }
  if (mode === "percent") {
    if (!Number.isFinite(value) || value <= 0 || value >= 100) {
      return { valid: false, discountedPriceCents: null, savingsCents: null, percentOff: null };
    }
    const discounted = Math.round(base * (1 - value / 100));
    if (discounted < 0 || discounted >= base) {
      return { valid: false, discountedPriceCents: null, savingsCents: null, percentOff: null };
    }
    return {
      valid: true,
      discountedPriceCents: discounted,
      savingsCents: base - discounted,
      percentOff: Math.round(value * 100) / 100,
    };
  }
  return { valid: false, discountedPriceCents: null, savingsCents: null, percentOff: null };
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

export function isConflictAdminError(error) {
  return hasStatusCode(error, 409);
}

export async function attachCustomOptionsIgnoringConflicts(input) {
  const attach = input?.attach;
  if (typeof attach !== "function") {
    throw new Error("attach callback is required");
  }

  const productIDs = normalizeSelectedProductIDs(input?.productIDs ?? []);
  const optionIDs = normalizeSelectedProductIDs(input?.optionIDs ?? []);
  const sortOrder = Number.isFinite(Number(input?.sortOrder)) ? Number(input.sortOrder) : 0;

  let attached = 0;
  let ignored = 0;

  for (const productID of productIDs) {
    for (const optionID of optionIDs) {
      try {
        await attach(productID, { option_id: optionID, sort_order: sortOrder });
        attached += 1;
      } catch (error) {
        if (isConflictAdminError(error)) {
          ignored += 1;
          continue;
        }
        throw error;
      }
    }
  }

  return {
    attached,
    ignored,
    attempted: productIDs.length * optionIDs.length,
  };
}

function hasStatusCode(error, statusCode) {
  if (!(error instanceof Error)) return false;
  return new RegExp(`\\b${statusCode}\\b`).test(error.message);
}
