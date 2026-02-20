"use client";

import * as React from "react";
import Link from "next/link";
import { Button as HeroButton, Chip } from "@heroui/react";
import { ShoppingCart } from "lucide-react";
import { Button as UIButton } from "@/components/ui/button";
import { useCart } from "@/components/cart-context";
import type { AdminCustomOption, CartCustomOptionSelectionInput, ProductVariant } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type OptionSelectionState = {
  valueId: string;
  valueIds: string[];
  valueText: string;
};

type AddToCartButtonProps = {
  variants: ProductVariant[];
  customOptions?: AdminCustomOption[];
  selectedVariantID?: string;
  onSelectedVariantIDChange?: (id: string) => void;
  showSelectionMeta?: boolean;
};

function normalizeOptionDefaults(option: AdminCustomOption): OptionSelectionState {
  if (option.type === "dropdown" || option.type === "radio") {
    const defaultValue = option.values.find((value) => value.is_default);
    return { valueId: defaultValue?.id ?? "", valueIds: [], valueText: "" };
  }
  if (option.type === "checkbox" || option.type === "multiple") {
    const defaultIDs = option.values.filter((value) => value.is_default).map((value) => value.id);
    return { valueId: "", valueIds: defaultIDs, valueText: "" };
  }
  return { valueId: "", valueIds: [], valueText: "" };
}

function pricingDeltaCents(basePriceCents: number, priceType?: "fixed" | "percent" | null, priceValue?: number | null): number {
  if (!priceType || priceValue === null || priceValue === undefined) return 0;
  if (priceType === "fixed") return Math.round(priceValue * 100);
  if (priceType === "percent") return Math.round(basePriceCents * (priceValue / 100));
  return 0;
}

function dedupeSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0))).sort();
}

export function AddToCartButton({
  variants,
  customOptions = [],
  selectedVariantID,
  onSelectedVariantIDChange,
  showSelectionMeta = true,
}: AddToCartButtonProps) {
  const [selectedAttributes, setSelectedAttributes] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string>("");
  const [selectionErrors, setSelectionErrors] = React.useState<Record<string, string>>({});
  const { add } = useCart();

  const activeCustomOptions = React.useMemo(
    () =>
      customOptions
        .filter((option) => option.is_active)
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order),
    [customOptions],
  );

  const [customOptionSelections, setCustomOptionSelections] = React.useState<Record<string, OptionSelectionState>>({});

  React.useEffect(() => {
    setCustomOptionSelections((prev) => {
      const next: Record<string, OptionSelectionState> = {};
      for (const option of activeCustomOptions) {
        next[option.id] = prev[option.id] ?? normalizeOptionDefaults(option);
      }
      return next;
    });
    setSelectionErrors({});
  }, [activeCustomOptions]);

  const allAttributes = React.useMemo(() => {
    const keys = Array.from(new Set(variants.flatMap((v) => Object.keys(v.attributes || {}))));
    const values: Record<string, string[]> = {};
    keys.forEach((key) => {
      values[key] = Array.from(
        new Set(
          variants
            .map((v) => v.attributes?.[key])
            .filter((v) => v !== undefined && v !== null)
            .map(String),
        ),
      );
    });
    return { keys, values };
  }, [variants]);

  const selectedVariant = React.useMemo(() => {
    if (Object.keys(selectedAttributes).length === 0) return null;
    return (
      variants.find((v) => {
        return Object.entries(selectedAttributes).every(([key, value]) => {
          return String(v.attributes?.[key]) === value;
        });
      }) ?? null
    );
  }, [variants, selectedAttributes]);

  React.useEffect(() => {
    if (selectedVariantID) {
      const variant = variants.find((v) => v.id === selectedVariantID);
      if (variant) {
        const nextAttrs: Record<string, string> = {};
        Object.entries(variant.attributes || {}).forEach(([k, v]) => {
          nextAttrs[k] = String(v);
        });
        const currentKeys = Object.keys(selectedAttributes);
        const nextKeys = Object.keys(nextAttrs);
        const changed = currentKeys.length !== nextKeys.length || currentKeys.some((k) => selectedAttributes[k] !== nextAttrs[k]);
        if (changed) setSelectedAttributes(nextAttrs);
      }
    }
  }, [selectedVariantID, variants, selectedAttributes]);

  React.useEffect(() => {
    if (selectedVariant && onSelectedVariantIDChange && selectedVariant.id !== selectedVariantID) {
      onSelectedVariantIDChange(selectedVariant.id);
    }
  }, [selectedVariant, onSelectedVariantIDChange, selectedVariantID]);

  React.useEffect(() => {
    if (!selectedVariantID && variants.length > 0 && Object.keys(selectedAttributes).length === 0) {
      const firstAvailable = variants.find((variant) => variant.stock > 0) ?? variants[0];
      const initialAttrs: Record<string, string> = {};
      Object.entries(firstAvailable.attributes || {}).forEach(([k, v]) => {
        initialAttrs[k] = String(v);
      });
      setSelectedAttributes(initialAttrs);
    }
  }, [variants, selectedAttributes, selectedVariantID]);

  const hasPurchasableVariant = variants.some((variant) => variant.stock > 0);
  const disableControls = variants.length === 0 || !hasPurchasableVariant;
  const canAdd = !!selectedVariant && selectedVariant.stock > 0;

  const customOptionsDeltaCents = React.useMemo(() => {
    if (!selectedVariant) return 0;
    let total = 0;
    for (const option of activeCustomOptions) {
      const selection = customOptionSelections[option.id];
      if (!selection) continue;

      if (option.type === "dropdown" || option.type === "radio") {
        if (!selection.valueId) continue;
        const value = option.values.find((item) => item.id === selection.valueId);
        if (!value) continue;
        total += pricingDeltaCents(selectedVariant.priceCents, value.price_type, value.price_value);
        continue;
      }

      if (option.type === "checkbox" || option.type === "multiple") {
        for (const valueID of selection.valueIds) {
          const value = option.values.find((item) => item.id === valueID);
          if (!value) continue;
          total += pricingDeltaCents(selectedVariant.priceCents, value.price_type, value.price_value);
        }
        continue;
      }

      if (selection.valueText.trim().length > 0) {
        total += pricingDeltaCents(selectedVariant.priceCents, option.price_type, option.price_value);
      }
    }
    return total;
  }, [activeCustomOptions, customOptionSelections, selectedVariant]);

  const selectedPriceCents = selectedVariant ? selectedVariant.priceCents + customOptionsDeltaCents : null;

  const buildCustomOptionPayload = React.useCallback((): { ok: boolean; payload: CartCustomOptionSelectionInput[] } => {
    const nextErrors: Record<string, string> = {};
    const payload: CartCustomOptionSelectionInput[] = [];

    for (const option of activeCustomOptions) {
      const selection = customOptionSelections[option.id] ?? normalizeOptionDefaults(option);
      if (option.type === "dropdown" || option.type === "radio") {
        const valueID = selection.valueId.trim();
        if (valueID.length === 0) {
          if (option.required) nextErrors[option.id] = `${option.title} is required`;
          continue;
        }
        payload.push({ option_id: option.id, type: option.type, value_id: valueID });
        continue;
      }
      if (option.type === "checkbox" || option.type === "multiple") {
        const valueIDs = dedupeSorted(selection.valueIds);
        if (valueIDs.length === 0) {
          if (option.required) nextErrors[option.id] = `${option.title} is required`;
          continue;
        }
        payload.push({ option_id: option.id, type: option.type, value_ids: valueIDs });
        continue;
      }
      const valueText = selection.valueText.trim();
      if (valueText.length === 0) {
        if (option.required) nextErrors[option.id] = `${option.title} is required`;
        continue;
      }
      payload.push({ option_id: option.id, type: option.type, value_text: valueText });
    }

    setSelectionErrors(nextErrors);
    return { ok: Object.keys(nextErrors).length === 0, payload };
  }, [activeCustomOptions, customOptionSelections]);

  async function onClick() {
    if (!selectedVariant) return;
    const selection = buildCustomOptionPayload();
    if (!selection.ok) {
      setStatus("error");
      setMessage("Please complete required custom options.");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      await add(selectedVariant.id, 1, selection.payload);
      setStatus("done");
      setMessage("Added to cart.");
    } catch {
      setStatus("error");
      setMessage("Failed to add item. Please try again.");
    }
  }

  const handleAttributeChange = (key: string, value: string) => {
    setSelectedAttributes((prev) => {
      const next = { ...prev, [key]: value };
      const exists = variants.some((v) => {
        return Object.entries(next).every(([k, val]) => String(v.attributes?.[k]) === val);
      });
      if (!exists) {
        const matchingVariant = variants.find((v) => String(v.attributes?.[key]) === value) || variants[0];
        if (matchingVariant) {
          const newAttrs: Record<string, string> = {};
          Object.entries(matchingVariant.attributes || {}).forEach(([k, v]) => {
            newAttrs[k] = String(v);
          });
          return newAttrs;
        }
      }
      return next;
    });
  };

  if (variants.length === 0) {
    return (
      <div className="space-y-4">
        <div className="glass rounded-2xl border border-white/10 bg-background/60 p-4">
          <Chip size="sm" color="warning" variant="flat">
            Unavailable
          </Chip>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            This product is not available for purchase yet. Check back soon.
          </p>
          <UIButton asChild variant="outline" className="mt-3 rounded-xl">
            <Link href="/products">Back to products</Link>
          </UIButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-border bg-background/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Price</h2>
        <p className="mt-1 text-3xl font-semibold">
          {(() => {
            if (selectedVariant && selectedPriceCents !== null) {
              return formatMoney(selectedPriceCents, selectedVariant.currency);
            }
            if (variants.length > 0) {
              const prices = variants.map((v) => v.priceCents);
              const minPrice = Math.min(...prices);
              const maxPrice = Math.max(...prices);
              const currency = variants[0].currency;
              if (minPrice === maxPrice) return formatMoney(minPrice, currency);
              return `${formatMoney(minPrice, currency)} - ${formatMoney(maxPrice, currency)}`;
            }
            return "N/A";
          })()}
        </p>
        {selectedVariant && customOptionsDeltaCents > 0 && (
          <p className="mt-1 text-xs text-neutral-500">
            Includes {formatMoney(customOptionsDeltaCents, selectedVariant.currency)} custom options
          </p>
        )}
      </div>

      <div className="space-y-4">
        {allAttributes.keys.map((key) => (
          <div key={key} className="space-y-2">
            <span className="text-sm font-medium capitalize">{key}</span>
            <div className="flex flex-wrap gap-2">
              {allAttributes.values[key].map((value) => {
                const isSelected = selectedAttributes[key] === value;
                return (
                  <button
                    key={value}
                    onClick={() => handleAttributeChange(key, value)}
                    disabled={disableControls}
                    className={`
                      rounded-xl border px-4 py-2 text-sm font-medium transition-all
                      ${isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-surface-border bg-surface text-neutral-600 hover:border-primary/50 dark:text-neutral-300"}
                    `}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {showSelectionMeta && activeCustomOptions.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-surface-border bg-background/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Custom Options</p>
          {activeCustomOptions.map((option) => {
            const selection = customOptionSelections[option.id] ?? normalizeOptionDefaults(option);
            const error = selectionErrors[option.id];

            return (
              <div key={option.id} className="space-y-2">
                <div className="text-sm font-medium">
                  {option.title}
                  {option.required ? <span className="ml-1 text-red-500">*</span> : null}
                </div>

                {(option.type === "dropdown" || option.type === "radio") && option.display_mode === "buttons" && (
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const isSelected = selection.valueId === value.id;
                      return (
                        <button
                          key={value.id}
                          onClick={() => {
                            setCustomOptionSelections((prev) => ({
                              ...prev,
                              [option.id]: { ...selection, valueId: isSelected ? "" : value.id },
                            }));
                          }}
                          className={`
                            rounded-xl border px-4 py-2 text-sm font-medium transition-all
                            ${isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-surface-border bg-surface text-neutral-600 hover:border-primary/50 dark:text-neutral-300"}
                          `}
                        >
                          {value.title}
                        </button>
                      );
                    })}
                  </div>
                )}

                {(option.type === "checkbox" || option.type === "multiple") && option.display_mode === "buttons" && (
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const isSelected = selection.valueIds.includes(value.id);
                      return (
                        <button
                          key={value.id}
                          onClick={() => {
                            const nextIDs = isSelected
                              ? selection.valueIds.filter((id) => id !== value.id)
                              : dedupeSorted([...selection.valueIds, value.id]);
                            setCustomOptionSelections((prev) => ({
                              ...prev,
                              [option.id]: { ...selection, valueIds: nextIDs },
                            }));
                          }}
                          className={`
                            rounded-xl border px-4 py-2 text-sm font-medium transition-all
                            ${isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-surface-border bg-surface text-neutral-600 hover:border-primary/50 dark:text-neutral-300"}
                          `}
                        >
                          {value.title}
                        </button>
                      );
                    })}
                  </div>
                )}

                {(option.type === "dropdown" || option.type === "radio") && option.display_mode !== "buttons" && (
                  <select
                    className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
                    value={selection.valueId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCustomOptionSelections((prev) => ({
                        ...prev,
                        [option.id]: { ...selection, valueId: value },
                      }));
                    }}
                  >
                    <option value="">Select an option</option>
                    {option.values.map((value) => (
                      <option key={value.id} value={value.id}>
                        {value.title}
                      </option>
                    ))}
                  </select>
                )}

                {(option.type === "checkbox" || option.type === "multiple") && option.display_mode !== "buttons" && (
                  <div className="space-y-2">
                    {option.values.map((value) => {
                      const checked = selection.valueIds.includes(value.id);
                      return (
                        <label key={value.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const nextIDs = event.target.checked
                                ? dedupeSorted([...selection.valueIds, value.id])
                                : selection.valueIds.filter((id) => id !== value.id);
                              setCustomOptionSelections((prev) => ({
                                ...prev,
                                [option.id]: { ...selection, valueIds: nextIDs },
                              }));
                            }}
                          />
                          <span>{value.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {(option.type === "field" || option.type === "file" || option.type === "date" || option.type === "time" || option.type === "datetime") && (
                  <input
                    type={option.type === "file" ? "text" : option.type === "datetime" ? "datetime-local" : option.type}
                    className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
                    value={selection.valueText}
                    onChange={(event) => {
                      setCustomOptionSelections((prev) => ({
                        ...prev,
                        [option.id]: { ...selection, valueText: event.target.value },
                      }));
                    }}
                    placeholder={option.type === "file" ? "Enter file reference" : undefined}
                  />
                )}

                {option.type === "area" && (
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
                    value={selection.valueText}
                    onChange={(event) => {
                      setCustomOptionSelections((prev) => ({
                        ...prev,
                        [option.id]: { ...selection, valueText: event.target.value },
                      }));
                    }}
                  />
                )}

                {error ? <p className="text-xs text-red-500">{error}</p> : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <HeroButton
          onPress={onClick}
          size="lg"
          radius="lg"
          variant="solid"
          className="h-12 w-full bg-blue-600 text-base font-semibold text-white shadow-sm transition-transform hover:bg-blue-500 data-[hover=true]:scale-[1.01]"
          isLoading={status === "loading"}
          isDisabled={status === "loading" || !canAdd || disableControls}
          startContent={status === "loading" ? null : <ShoppingCart size={18} aria-hidden />}
        >
          {!hasPurchasableVariant ? "Out of Stock" : "Add to Cart"}
        </HeroButton>

        {selectedVariant && selectedVariant.stock > 0 && selectedVariant.stock <= 5 && (
          <p className="text-center text-xs font-medium text-orange-600 dark:text-orange-400">Only {selectedVariant.stock} left in stock!</p>
        )}

        {message && (
          <p className={`text-center text-sm ${status === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
            {message}
          </p>
        )}
      </div>

      {!hasPurchasableVariant && (
        <div className="glass rounded-2xl border border-white/10 bg-background/60 p-4">
          <Chip size="sm" color="warning" variant="flat">
            Out of stock
          </Chip>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">All variants are currently out of stock.</p>
          <UIButton asChild variant="outline" className="mt-3 w-full rounded-xl">
            <Link href="/products">Back to products</Link>
          </UIButton>
        </div>
      )}
    </div>
  );
}
