"use client";

import { type FormEvent, type Key, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Input,
  Radio,
  RadioGroup,
  Select,
  SelectItem,
  SelectSection,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Trash2 } from "lucide-react";
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

function selectionToKey(selection: "all" | Set<Key>): string | null {
  if (selection === "all") return null;
  const first = selection.values().next().value;
  if (typeof first === "string") return first;
  if (typeof first === "number") return String(first);
  return null;
}

function isOptionType(value: string): value is OptionType {
  return typeGroups.some((group) => group.options.some((option) => option.value === value));
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
  const selectedTypeKeys = useMemo(() => new Set<Key>([type]), [type]);

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

      <Card className="glass rounded-2xl border border-surface-border/80">
        <CardBody className="space-y-4 p-4 md:p-5">
          <h2 className="text-base font-semibold">Basic</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Title"
              name="title"
              value={title}
              onValueChange={onTitleChange}
              minLength={2}
              isRequired
              variant="bordered"
              className="md:col-span-2"
              classNames={{ inputWrapper: "border-surface-border bg-background/60" }}
            />
            <Input
              label="Code"
              name="code"
              value={code}
              onValueChange={(nextCode) => {
                setCodeTouched(true);
                setCode(nextCode);
              }}
              pattern="[a-z0-9-]+"
              isRequired
              variant="bordered"
              className="font-mono"
              classNames={{ inputWrapper: "border-surface-border bg-background/60", input: "font-mono" }}
            />
            <Input
              label="Sort order"
              name="sort_order"
              value={sortOrder}
              onValueChange={setSortOrder}
              type="number"
              variant="bordered"
              classNames={{ inputWrapper: "border-surface-border bg-background/60" }}
            />
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-surface-border bg-background/40 px-3 py-2 md:col-span-2">
              <Checkbox isSelected={required} onValueChange={setRequired}>
                Required
              </Checkbox>
              <Checkbox isSelected={isActive} onValueChange={setIsActive}>
                Active
              </Checkbox>
              <input type="hidden" name="required" value={required ? "true" : "false"} />
              <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="glass rounded-2xl border border-surface-border/80">
        <CardBody className="space-y-4 p-4 md:p-5">
          <div>
            <h2 className="text-base font-semibold">Option Type</h2>
            <p className="mt-1 text-sm text-foreground/70">Pick a Magento-style type group and concrete option type.</p>
          </div>
          <Select
            label="Type"
            name="type"
            selectedKeys={selectedTypeKeys}
            onSelectionChange={(selection) => {
              const next = selectionToKey(selection);
              if (next && isOptionType(next)) setType(next);
            }}
            variant="bordered"
            classNames={{ trigger: "border-surface-border bg-background/60" }}
          >
            {typeGroups.map((group) => (
              <SelectSection key={group.label} title={group.label}>
                {group.options.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </SelectSection>
            ))}
          </Select>
        </CardBody>
      </Card>

      {typeGroup !== "select" && (
        <Card className="glass rounded-2xl border border-surface-border/80">
          <CardBody className="space-y-4 p-4 md:p-5">
            <h2 className="text-base font-semibold">Pricing</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <RadioGroup
                label="Price Type"
                name="price_type"
                value={priceType}
                onValueChange={(value) => setPriceType(value as PriceType)}
                orientation="horizontal"
                className="md:col-span-2"
              >
                <Radio value="fixed">Fixed</Radio>
                <Radio value="percent">Percent</Radio>
              </RadioGroup>
              <Input
                label="Price Value"
                name="price_value"
                value={priceValue}
                onValueChange={setPriceValue}
                type="number"
                step="0.01"
                min="0"
                isRequired
                variant="bordered"
                classNames={{ inputWrapper: "border-surface-border bg-background/60" }}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {typeGroup === "select" && (
        <Card className="glass rounded-2xl border border-surface-border/80">
          <CardBody className="space-y-4 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Values</h2>
                <p className="text-sm text-foreground/70">Each value controls its own price type and amount.</p>
              </div>
              <Button type="button" color="primary" variant="flat" onPress={addValue}>
                Add value
              </Button>
            </div>

            <Table
              aria-label="Custom option values"
              removeWrapper
              classNames={{
                table: "min-w-[760px]",
                th: "bg-transparent text-foreground/65",
                td: "align-middle",
              }}
            >
              <TableHeader>
                <TableColumn>Title</TableColumn>
                <TableColumn>Price Type</TableColumn>
                <TableColumn>Price Value</TableColumn>
                <TableColumn>Sort</TableColumn>
                <TableColumn>Default</TableColumn>
                <TableColumn className="text-right">Delete</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No values yet. Add at least one value for select options.">
                {values.map((value, index) => (
                  <TableRow key={`value-${index}`}>
                    <TableCell>
                      <Input
                        value={value.title}
                        onValueChange={(nextValue) => updateValue(index, { title: nextValue })}
                        isRequired
                        variant="bordered"
                        classNames={{ inputWrapper: "border-surface-border bg-background/60" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        aria-label="Value price type"
                        selectedKeys={new Set<Key>([value.price_type])}
                        onSelectionChange={(selection) => {
                          const next = selectionToKey(selection);
                          if (next === "fixed" || next === "percent") {
                            updateValue(index, { price_type: next });
                          }
                        }}
                        variant="bordered"
                        classNames={{ trigger: "border-surface-border bg-background/60 min-h-10" }}
                      >
                        <SelectItem key="fixed">Fixed</SelectItem>
                        <SelectItem key="percent">Percent</SelectItem>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={value.price_value}
                        onValueChange={(nextValue) => updateValue(index, { price_value: nextValue })}
                        type="number"
                        step="0.01"
                        min="0"
                        isRequired
                        variant="bordered"
                        classNames={{ inputWrapper: "border-surface-border bg-background/60" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={value.sort_order}
                        onValueChange={(nextValue) => updateValue(index, { sort_order: nextValue })}
                        type="number"
                        variant="bordered"
                        classNames={{ inputWrapper: "border-surface-border bg-background/60 w-24" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox isSelected={value.is_default} onValueChange={(nextValue) => updateValue(index, { is_default: nextValue })}>
                        Default
                      </Checkbox>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        isIconOnly
                        color="danger"
                        variant="light"
                        onPress={() => removeValue(index)}
                        aria-label="Delete value"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      {clientError && (
        <Card className="rounded-2xl border border-danger-200/60 bg-danger-50/70">
          <CardBody className="py-3 text-sm text-danger-700">{clientError}</CardBody>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button as={Link} href={cancelHref} variant="bordered">
          Cancel
        </Button>
        <Button type="submit" color="primary" variant="flat">
          {mode === "create" ? "Create option" : "Save option"}
        </Button>
      </div>
    </form>
  );
}
