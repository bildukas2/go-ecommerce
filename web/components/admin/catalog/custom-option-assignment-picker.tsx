"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminCustomOption } from "@/lib/api";

type CustomOption = Pick<AdminCustomOption, "id" | "title" | "type_group" | "type">;

type Props = {
  options: CustomOption[];
  pickerValue: string;
  pickerListID: string;
  selectedOptionIDs: string[];
  onPickerValueChange: (value: string) => void;
  onSelectedOptionIDsChange: (value: string[]) => void;
};

function parsePickerValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/\(([^()]+)\)\s*$/);
  if (match?.[1]) return match[1].trim();
  return trimmed;
}

export function CustomOptionAssignmentPicker({
  options,
  pickerValue,
  pickerListID,
  selectedOptionIDs,
  onPickerValueChange,
  onSelectedOptionIDsChange,
}: Props) {
  const [pickerError, setPickerError] = useState("");

  const optionByID = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const optionByTitle = useMemo(() => {
    return new Map(options.map((option) => [option.title.trim().toLowerCase(), option]));
  }, [options]);

  const selectedOptions = selectedOptionIDs
    .map((id) => optionByID.get(id))
    .filter((value): value is CustomOption => Boolean(value));

  const addSelectedOption = () => {
    const normalized = parsePickerValue(pickerValue);
    if (!normalized) {
      setPickerError("Pick an option before adding.");
      return;
    }

    const byID = optionByID.get(normalized);
    const byTitle = optionByTitle.get(normalized.toLowerCase());
    const option = byID ?? byTitle;

    if (!option) {
      setPickerError("Option not found. Pick from suggestions.");
      return;
    }

    if (selectedOptionIDs.includes(option.id)) {
      setPickerError("Option already added.");
      return;
    }

    onSelectedOptionIDsChange([...selectedOptionIDs, option.id]);
    onPickerValueChange("");
    setPickerError("");
  };

  const removeSelectedOption = (optionID: string) => {
    onSelectedOptionIDsChange(selectedOptionIDs.filter((id) => id !== optionID));
    setPickerError("");
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={pickerValue}
          onChange={(event) => onPickerValueChange(event.target.value)}
          list={pickerListID}
          placeholder="Type to search option title or paste ID"
          className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addSelectedOption}
          className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
        >
          Add option
        </button>
      </div>
      <datalist id={pickerListID}>
        {options.map((option) => (
          <option key={`picker-option-${pickerListID}-${option.id}`} value={`${option.title} (${option.id})`} />
        ))}
      </datalist>

      {pickerError ? <p className="text-xs text-red-600 dark:text-red-300">{pickerError}</p> : null}

      {selectedOptions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-surface-border px-3 py-2 text-xs text-foreground/65">
          No options added yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {selectedOptions.map((option) => (
            <li
              key={option.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{option.title}</p>
                <p className="text-xs text-foreground/65">
                  {option.type_group}/{option.type}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/catalog/custom-options/${option.id}`}
                  className="rounded-md border border-surface-border px-2 py-1 text-xs hover:bg-foreground/[0.05]"
                >
                  Customize option
                </Link>
                <button
                  type="button"
                  onClick={() => removeSelectedOption(option.id)}
                  className="rounded-md border border-red-500/35 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-500/16 dark:text-red-300"
                >
                  Remove from product
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
