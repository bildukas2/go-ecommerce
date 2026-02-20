import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Layers3 } from "lucide-react";
import { CustomOptionDeleteButton } from "@/components/admin/catalog/custom-option-delete-button";
import {
  createAdminCustomOption,
  deleteAdminCustomOption,
  getAdminCustomOption,
  getAdminCustomOptions,
  type AdminCustomOption,
} from "@/lib/api";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

const typeGroupOptions = [
  { value: "", label: "All types" },
  { value: "text", label: "Text" },
  { value: "file", label: "File" },
  { value: "select", label: "Select" },
  { value: "date", label: "Date" },
] as const;

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function messageHref(basePath: string, key: "notice" | "error", message: string): string {
  const path = basePath.startsWith("/") ? basePath : "/admin/catalog/custom-options";
  const url = new URL(`http://localhost${path}`);
  url.searchParams.set(key, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/admin/catalog/custom-options";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/admin/catalog/custom-options")) return "/admin/catalog/custom-options";
  return trimmed;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

function typeGroupLabel(typeGroup: AdminCustomOption["type_group"]): string {
  return typeGroup.slice(0, 1).toUpperCase() + typeGroup.slice(1);
}

function updatedLabel(value?: string): string {
  const parsed = Date.parse(value ?? "");
  if (!Number.isFinite(parsed)) return "Unknown";
  return new Date(parsed).toLocaleString();
}

function duplicatedCode(baseCode: string): string {
  const seed = Date.now().toString(36).slice(-4);
  return `${baseCode}-copy-${seed}`.slice(0, 64);
}

export default async function AdminCustomOptionsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const notice = firstQueryValue(resolvedSearchParams.notice);
  const actionError = firstQueryValue(resolvedSearchParams.error);
  const query = firstQueryValue(resolvedSearchParams.q).trim();
  const typeGroup = firstQueryValue(resolvedSearchParams.type_group).trim().toLowerCase();

  const currentQuery = new URLSearchParams();
  if (query) currentQuery.set("q", query);
  if (typeGroup) currentQuery.set("type_group", typeGroup);
  const currentHref = `/admin/catalog/custom-options${currentQuery.toString() ? `?${currentQuery.toString()}` : ""}`;

  const deleteAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const optionID = String(formData.get("option_id") ?? "").trim();
    if (!optionID) redirect(messageHref(returnTo, "error", "Missing option id"));
    let destination = messageHref(returnTo, "notice", "Custom option deleted");
    try {
      await deleteAdminCustomOption(optionID);
      revalidatePath("/admin/catalog/custom-options");
    } catch (error) {
      destination = messageHref(returnTo, "error", errorMessage(error));
    }
    redirect(destination);
  };

  const duplicateAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const optionID = String(formData.get("option_id") ?? "").trim();
    if (!optionID) redirect(messageHref(returnTo, "error", "Missing option id"));
    let destination = messageHref(returnTo, "notice", "Custom option duplicated");
    try {
      const original = await getAdminCustomOption(optionID);
      await createAdminCustomOption({
        store_id: original.store_id,
        code: duplicatedCode(original.code),
        title: `${original.title} Copy`,
        type_group: original.type_group,
        type: original.type,
        required: original.required,
        sort_order: original.sort_order,
        price_type: original.price_type ?? null,
        price_value: original.price_value ?? null,
        is_active: original.is_active,
        values: original.values.map((value) => ({
          title: value.title,
          sku: value.sku ?? null,
          sort_order: value.sort_order,
          price_type: value.price_type,
          price_value: value.price_value,
          is_default: value.is_default,
        })),
      });
      revalidatePath("/admin/catalog/custom-options");
    } catch (error) {
      destination = messageHref(returnTo, "error", errorMessage(error));
    }
    redirect(destination);
  };

  let items: AdminCustomOption[] = [];
  let fetchError: string | null = null;
  try {
    const response = await getAdminCustomOptions({
      q: query || undefined,
      type_group: typeGroup || undefined,
    });
    items = response.items;
  } catch (error) {
    if (error instanceof Error && error.message.includes("401")) {
      fetchError = "Unauthorized. Please check your admin credentials.";
    } else {
      fetchError = "Failed to load customizable options. Please retry.";
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customizable Options</h1>
          <p className="text-sm text-foreground/70">Manage reusable product options and value-based pricing.</p>
        </div>
        <Link
          href="/admin/catalog/custom-options/new"
          className="rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
        >
          Create option
        </Link>
      </div>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}
      {actionError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div>}
      {fetchError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}

      <Card className="glass rounded-2xl border border-surface-border/80">
        <CardBody className="p-4">
          <form method="get" action="/admin/catalog/custom-options" className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
            <Input
              name="q"
              label="Search"
              defaultValue={query}
              placeholder="Gift wrap"
              variant="bordered"
              classNames={{ inputWrapper: "border-surface-border bg-background/60" }}
            />
            <Select
              name="type_group"
              label="Type group"
              defaultSelectedKeys={new Set([typeGroup || ""])}
              variant="bordered"
              classNames={{ trigger: "border-surface-border bg-background/60" }}
            >
              {typeGroupOptions.map((option) => (
                <SelectItem key={option.value}>{option.label}</SelectItem>
              ))}
            </Select>
            <Button type="submit" color="primary" variant="flat" className="md:self-end">
              Apply
            </Button>
          </form>
        </CardBody>
      </Card>

      {items.length === 0 ? (
        <Card className="glass rounded-2xl border border-surface-border/80 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]">
          <CardBody className="flex min-h-[280px] items-center justify-center p-8">
            <div className="mx-auto max-w-md space-y-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-cyan-400/35 bg-cyan-400/10 text-cyan-700 dark:text-cyan-300">
                <Layers3 size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">No customizable options yet</h2>
                <p className="mt-1 text-sm text-foreground/70">
                  {fetchError ? "No options loaded right now." : "No customizable options match the current filters."}
                </p>
              </div>
              <Button as={Link} href="/admin/catalog/custom-options/new" color="primary" variant="flat">
                Create option
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card className="glass rounded-2xl border border-surface-border/80 shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]">
          <CardBody className="overflow-x-auto p-0">
            <Table
              aria-label="Customizable options table"
              removeWrapper
              classNames={{
                table: "min-w-[980px]",
                th: "bg-foreground/[0.02] text-foreground/65",
                td: "align-top",
              }}
            >
              <TableHeader>
                <TableColumn>Title</TableColumn>
                <TableColumn>Type</TableColumn>
                <TableColumn>Required</TableColumn>
                <TableColumn>Updated</TableColumn>
                <TableColumn>Active</TableColumn>
                <TableColumn align="end">Actions</TableColumn>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-semibold">{item.title}</p>
                      <p className="font-mono text-xs text-foreground/60">{item.code}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Chip size="sm" variant="flat" color="primary">
                          {typeGroupLabel(item.type_group)}
                        </Chip>
                        <Chip size="sm" variant="flat" color="default">
                          {item.type}
                        </Chip>
                      </div>
                    </TableCell>
                    <TableCell>{item.required ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-foreground/75">{updatedLabel(item.updated_at)}</TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={item.is_active ? "success" : "default"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          as={Link}
                          href={`/admin/catalog/custom-options/${item.id}`}
                          size="sm"
                          color="primary"
                          variant="flat"
                        >
                          Edit
                        </Button>
                        <form action={duplicateAction}>
                          <input type="hidden" name="option_id" value={item.id} />
                          <input type="hidden" name="return_to" value={currentHref} />
                          <Button type="submit" size="sm" variant="bordered">
                            Duplicate
                          </Button>
                        </form>
                        <CustomOptionDeleteButton
                          action={deleteAction}
                          optionID={item.id}
                          returnTo={currentHref}
                          optionTitle={item.title}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
