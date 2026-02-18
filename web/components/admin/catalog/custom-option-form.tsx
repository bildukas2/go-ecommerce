"use client";

import { type FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import type { AdminCustomOption, AdminCustomOptionValueMutationInput } from "@/lib/api";

type OptionType = AdminCustomOption["type"];
type TypeGroup = AdminCustomOption["type_group"];
type PriceType = NonNullable<AdminCustomOption["price_type"]>;

type CustomOptionFormProps = {
  mode: "create" | "edit";
  submitAction: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  initial?: AdminCustomOption;
};

type ValueDraft = {
  title: string;
  sku: string;
  sort_order: string;
  price_type: PriceType;
  price_value: string;
  is_default: boolean;
};

const typeGroups: Array<{ label: string; options: Array<{ value: OptionType; label: string }> }> = [
  { label: "Text", options: [{ value: "field", label: "Field" }, { value: "area", label: "Area" }] },
  { label: "File", options: [{ value: "file", label: "File" }] },
  {
    label: "Select",
    options: [
      { value: "dropdown", label: "Drop-down" },
      { value: "radio", label: "Radio Buttons" },
      { value: "checkbox", label: "Checkbox" },
      { value: "multiple", label: "Multiple Select" },
    ],
  },
  { label: "Date", options: [{ value: "date", label: "Date" }, { value: "datetime", label: "Date & Time" }, { value: "time", label: "Time" }] },
];

function typeGroupFromType(type: OptionType): TypeGroup {
  if (type === "field" || type === "area") return "text";
  if (type === "file") return "file";
  if (type === "dropdown" || type === "radio" || type === "checkbox" || type === "multiple") return "select";
  return "date";
}

function slugifyCode(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function defaultTypeFromInitial(initial?: AdminCustomOption): OptionType {
  return initial?.type ?? "field";
}

function defaultValues(initial?: AdminCustomOption): ValueDraft[] {
  if (!initial || !Array.isArray(initial.values) || initial.values.length === 0) return [];
  return initial.values.map((value) => ({
    title: value.title,
    sku: value.sku ?? "",
    sort_order: String(value.sort_order ?? 0),
    price_type: value.price_type,
    price_value: String(value.price_value ?? 0),
    is_default: value.is_default,
  }));
}

function emptyValueDraft(nextSort: number): ValueDraft {
  return {
    title: "",
    sku: "",
    sort_order: String(nextSort),
    price_type: "fixed",
    price_value: "0",
    is_default: false,
  };
}

function normalizeValuesForPayload(values: ValueDraft[]): AdminCustomOptionValueMutationInput[] {
  return values.map((value) => ({
    title: value.title.trim(),
    sku: value.sku.trim() || null,
    sort_order: Number.parseInt(value.sort_order, 10) || 0,
    price_type: value.price_type,
    price_value: Number.parseFloat(value.price_value),
    is_default: value.is_default,
  }));
}

export function CustomOptionForm({ mode, submitAction, cancelHref, initial }: CustomOptionFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [codeTouched, setCodeTouched] = useState(Boolean(initial?.code));
  const [type, setType] = useState<OptionType>(defaultTypeFromInitial(initial));
  const [required, setRequired] = useState(initial?.required ?? false);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));
  const [priceType, setPriceType] = useState<PriceType>(initial?.price_type ?? "fixed");
  const [priceValue, setPriceValue] = useState(String(initial?.price_value ?? 0));
  const [values, setValues] = useState<ValueDraft[]>(defaultValues(initial));
  const [clientError, setClientError] = useState<string>("");

  const typeGroup = typeGroupFromType(type);
  const valuesJSON = useMemo(() => JSON.stringify(normalizeValuesForPayload(values)), [values]);

  const onTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    if (!codeTouched) {
      setCode(slugifyCode(nextTitle));
    }
  };

  const addValue = () => {
    const nextSort = values.length > 0 ? values.length : 0;
    setValues((current) => [...current, emptyValueDraft(nextSort)]);
  };

  const removeValue = (index: number) => {
    setValues((current) => current.filter((_, i) => i !== index));
  };

  const updateValue = (index: number, patch: Partial<ValueDraft>) => {
    setValues((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (typeGroup !== "select") {
      setClientError("");
      return;
    }

    if (values.length === 0) {
      event.preventDefault();
      setClientError("Select options must include at least one value.");
      return;
    }

    const hasInvalidValue = values.some((value) => {
      const parsedPrice = Number.parseFloat(value.price_value);
      return !value.title.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0;
    });

    if (hasInvalidValue) {
      event.preventDefault();
      setClientError("Each value needs title, price type, and a non-negative price.");
      return;
    }

    setClientError("");
  };

  return (
    <form action={submitAction} onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="type_group" value={typeGroup} />
      <input type="hidden" name="values_json" value={valuesJSON} />

      <section className="glass rounded-2xl border p-4 md:p-5">
        <h2 className="text-base font-semibold">Basic</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Title</span>
            <input
              name="title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              minLength={2}
              required
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Code</span>
            <input
              name="code"
              value={code}
              onChange={(event) => {
                setCodeTouched(true);
                setCode(event.target.value);
              }}
              pattern="[a-z0-9-]+"
              required
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 font-mono"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Sort order</span>
            <input
              name="sort_order"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              type="number"
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm">
            <input type="hidden" name="required" value="false" />
            <input
              name="required"
              type="checkbox"
              value="true"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
              className="h-4 w-4 rounded border-surface-border"
            />
            <span>Required</span>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm">
            <input type="hidden" name="is_active" value="false" />
            <input
              name="is_active"
              type="checkbox"
              value="true"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-surface-border"
            />
            <span>Active</span>
          </label>
        </div>
      </section>

      <section className="glass rounded-2xl border p-4 md:p-5">
        <h2 className="text-base font-semibold">Option Type</h2>
        <p className="mt-1 text-sm text-foreground/70">Pick a Magento-style type group and concrete option type.</p>
        <div className="mt-3">
          <label className="space-y-1 text-sm">
            <span>Type</span>
            <select
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as OptionType)}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            >
              {typeGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      </section>

      {typeGroup !== "select" && (
        <section className="glass rounded-2xl border p-4 md:p-5">
          <h2 className="text-base font-semibold">Pricing</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Price Type</span>
              <select
                name="price_type"
                value={priceType}
                onChange={(event) => setPriceType(event.target.value as PriceType)}
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              >
                <option value="fixed">Fixed</option>
                <option value="percent">Percent</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Price Value</span>
              <input
                name="price_value"
                value={priceValue}
                onChange={(event) => setPriceValue(event.target.value)}
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              />
            </label>
          </div>
        </section>
      )}

      {typeGroup === "select" && (
        <section className="glass rounded-2xl border p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Values</h2>
              <p className="text-sm text-foreground/70">Each value controls its own price type and amount.</p>
            </div>
            <button
              type="button"
              onClick={addValue}
              className="rounded-xl border border-blue-500/35 bg-blue-500/12 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
            >
              Add value
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-foreground/65">
                <tr>
                  <th className="px-2 py-2 font-medium">Title</th>
                  <th className="px-2 py-2 font-medium">Price Type</th>
                  <th className="px-2 py-2 font-medium">Price Value</th>
                  <th className="px-2 py-2 font-medium">Sort</th>
                  <th className="px-2 py-2 font-medium">Default</th>
                  <th className="px-2 py-2 font-medium text-right">Delete</th>
                </tr>
              </thead>
              <tbody>
                {values.map((value, index) => (
                  <tr key={`value-${index}`} className="border-t border-surface-border">
                    <td className="px-2 py-2">
                      <input
                        value={value.title}
                        onChange={(event) => updateValue(index, { title: event.target.value })}
                        required
                        className="w-full rounded-lg border border-surface-border bg-background px-3 py-2"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={value.price_type}
                        onChange={(event) => updateValue(index, { price_type: event.target.value as PriceType })}
                        className="w-full rounded-lg border border-surface-border bg-background px-3 py-2"
                      >
                        <option value="fixed">Fixed</option>
                        <option value="percent">Percent</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={value.price_value}
                        onChange={(event) => updateValue(index, { price_value: event.target.value })}
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        className="w-full rounded-lg border border-surface-border bg-background px-3 py-2"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={value.sort_order}
                        onChange={(event) => updateValue(index, { sort_order: event.target.value })}
                        type="number"
                        className="w-24 rounded-lg border border-surface-border bg-background px-3 py-2"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={value.is_default}
                        onChange={(event) => updateValue(index, { is_default: event.target.checked })}
                        className="h-4 w-4 rounded border-surface-border"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeValue(index)}
                        className="rounded-lg border border-red-500/35 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-500/16 dark:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {clientError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{clientError}</div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={cancelHref}
          className="rounded-xl border border-surface-border bg-foreground/[0.02] px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
        >
          {mode === "create" ? "Create option" : "Save option"}
        </button>
      </div>
    </form>
  );
}
