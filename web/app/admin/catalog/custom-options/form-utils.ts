import type { AdminCustomOptionMutationInput } from "@/lib/api";

type UnknownRecord = Record<string, unknown>;
const DEFAULT_SWATCH_HEX = "#0072F5";

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
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asBooleanFromForm(formData: FormData, name: string): boolean {
  return formData.getAll(name).some((v) => String(v).trim().toLowerCase() === "true");
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseOptionalInteger(value: FormDataEntryValue | null): number | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseValuesJSON(raw: FormDataEntryValue | null): AdminCustomOptionMutationInput["values"] {
  const normalized = String(raw ?? "").trim();
  if (!normalized) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("Invalid values payload");
  }

  if (!Array.isArray(parsed)) throw new Error("Invalid values payload");

  return parsed.map((entry) => {
    const row = asRecord(entry);
    return {
      title: asString(row.title).trim(),
      sku: asString(row.sku).trim() || null,
      sort_order: Math.trunc(asNumber(row.sort_order)),
      price_type: asString(row.price_type).trim().toLowerCase() === "percent" ? "percent" : "fixed",
      price_value: asNumber(row.price_value),
      is_default: Boolean(row.is_default),
      swatch_hex: asString(row.swatch_hex).trim() || null,
    };
  });
}

export function parseCustomOptionFormData(formData: FormData): AdminCustomOptionMutationInput {
  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim().toLowerCase();
  const typeGroup = String(formData.get("type_group") ?? "").trim().toLowerCase();
  const required = asBooleanFromForm(formData, "required");
  const isActive = asBooleanFromForm(formData, "is_active");
  const sortOrder = parseOptionalInteger(formData.get("sort_order"));
  const displayMode = asString(formData.get("display_mode")).trim().toLowerCase() || "default";
  const values = parseValuesJSON(formData.get("values_json")) ?? [];
  const normalizedValues =
    displayMode === "color_buttons"
      ? values.map((value) => ({
          ...value,
          swatch_hex: value.swatch_hex ?? DEFAULT_SWATCH_HEX,
        }))
      : values;

  const payload: AdminCustomOptionMutationInput = {
    code,
    title,
    type: type as AdminCustomOptionMutationInput["type"],
    type_group: typeGroup as AdminCustomOptionMutationInput["type_group"],
    required,
    is_active: isActive,
    sort_order: sortOrder ?? 0,
    display_mode: displayMode as AdminCustomOptionMutationInput["display_mode"],
    values: normalizedValues,
  };

  if (typeGroup === "select") {
    payload.price_type = null;
    payload.price_value = null;
  } else {
    const priceTypeRaw = String(formData.get("price_type") ?? "").trim().toLowerCase();
    payload.price_type = priceTypeRaw === "percent" ? "percent" : "fixed";
    payload.price_value = parseOptionalNumber(formData.get("price_value"));
  }

  return payload;
}
