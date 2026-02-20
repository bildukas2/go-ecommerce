const SELECT_TYPES = new Set(["dropdown", "radio", "checkbox", "multiple"]);
const DEFAULT_SWATCH_HEX = "#0072F5";

export function typeGroupFromType(type) {
  const normalized = String(type ?? "").trim().toLowerCase();
  if (normalized === "field" || normalized === "area") return "text";
  if (normalized === "file") return "file";
  if (SELECT_TYPES.has(normalized)) return "select";
  return "date";
}

export function buildCustomOptionPayload(input) {
  const type = String(input?.type ?? "").trim().toLowerCase();
  const typeGroup = typeGroupFromType(type);
  const displayMode = String(input?.display_mode ?? "").trim().toLowerCase() || "default";
  const values = normalizeValues(parseValues(input?.values_json));

  const payload = {
    code: String(input?.code ?? "").trim().toLowerCase(),
    title: String(input?.title ?? "").trim(),
    type_group: typeGroup,
    type,
    required: String(input?.required ?? "").trim().toLowerCase() === "true",
    is_active: String(input?.is_active ?? "").trim().toLowerCase() === "true",
    sort_order: parseInteger(input?.sort_order),
    display_mode: displayMode,
    values,
  };

  if (typeGroup === "select") {
    payload.price_type = null;
    payload.price_value = null;
  } else {
    payload.price_type = String(input?.price_type ?? "").trim().toLowerCase() === "percent" ? "percent" : "fixed";
    payload.price_value = parseFloatSafe(input?.price_value);
  }

  return payload;
}

export function validateSelectValues(values) {
  const list = Array.isArray(values) ? values : [];
  if (list.length === 0) return false;
  return list.every((row) => {
    const title = String(row?.title ?? "").trim();
    const price = Number.parseFloat(String(row?.price_value ?? ""));
    return title.length > 0 && Number.isFinite(price) && price >= 0;
  });
}

function parseValues(raw) {
  const normalized = String(raw ?? "").trim();
  if (!normalized) return [];
  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => ({
      title: String(row?.title ?? "").trim(),
      sku: String(row?.sku ?? "").trim() || null,
      sort_order: parseInteger(row?.sort_order),
      price_type: String(row?.price_type ?? "").trim().toLowerCase() === "percent" ? "percent" : "fixed",
      price_value: parseFloatSafe(row?.price_value),
      is_default: Boolean(row?.is_default),
      swatch_hex: String(row?.swatch_hex ?? "").trim() || null,
    }));
  } catch {
    return [];
  }
}

function normalizeValues(values) {
  return values.map((value) => ({
    ...value,
    swatch_hex: value?.swatch_hex ?? DEFAULT_SWATCH_HEX,
  }));
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function parseFloatSafe(value) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}
