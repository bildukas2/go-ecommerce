import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function typeLabel(option: AdminCustomOption): string {
  const typeGroupLabel = option.type_group.slice(0, 1).toUpperCase() + option.type_group.slice(1);
  return `${typeGroupLabel} / ${option.type}`;
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
  const notice = firstQueryValue(searchParams?.notice);
  const actionError = firstQueryValue(searchParams?.error);
  const query = firstQueryValue(searchParams?.q).trim();
  const typeGroup = firstQueryValue(searchParams?.type_group).trim().toLowerCase();

  const currentQuery = new URLSearchParams();
  if (query) currentQuery.set("q", query);
  if (typeGroup) currentQuery.set("type_group", typeGroup);
  const currentHref = `/admin/catalog/custom-options${currentQuery.toString() ? `?${currentQuery.toString()}` : ""}`;

  const deleteAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const optionID = String(formData.get("option_id") ?? "").trim();
    if (!optionID) redirect(messageHref(returnTo, "error", "Missing option id"));
    try {
      await deleteAdminCustomOption(optionID);
      revalidatePath("/admin/catalog/custom-options");
      redirect(messageHref(returnTo, "notice", "Custom option deleted"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const duplicateAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const optionID = String(formData.get("option_id") ?? "").trim();
    if (!optionID) redirect(messageHref(returnTo, "error", "Missing option id"));
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
      redirect(messageHref(returnTo, "notice", "Custom option duplicated"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  let items: AdminCustomOption[] = [];
  let fetchError: string | null = null;
  try {
    const response = await getAdminCustomOptions({
      q: query || undefined,
      type_group: typeGroup || undefined,
    });
    items = response.items;
  } catch {
    fetchError = "Failed to load customizable options. Please retry.";
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

      <section className="glass rounded-2xl border p-4">
        <form method="get" action="/admin/catalog/custom-options" className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">Search by title</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Gift wrap"
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">Type group</span>
            <select
              name="type_group"
              defaultValue={typeGroup}
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            >
              {typeGroupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="mt-6 rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
          >
            Apply
          </button>
        </form>
      </section>

      <section className="glass overflow-x-auto rounded-2xl border shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Required</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-foreground/60">
                  {fetchError ? "No options loaded." : "No customizable options match the current filters."}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-surface-border align-top">
                  <td className="px-3 py-3">
                    <p className="font-semibold">{item.title}</p>
                    <p className="font-mono text-xs text-foreground/60">{item.code}</p>
                  </td>
                  <td className="px-3 py-3">{typeLabel(item)}</td>
                  <td className="px-3 py-3">{item.required ? "Yes" : "No"}</td>
                  <td className="px-3 py-3 text-foreground/75">{updatedLabel(item.updated_at)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.is_active
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-500/20 text-slate-700 dark:text-slate-300"
                    }`}>
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/catalog/custom-options/${item.id}`}
                        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium hover:bg-foreground/[0.05]"
                      >
                        Edit
                      </Link>
                      <form action={duplicateAction}>
                        <input type="hidden" name="option_id" value={item.id} />
                        <input type="hidden" name="return_to" value={currentHref} />
                        <button
                          type="submit"
                          className="rounded-lg border border-blue-500/35 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-500/16 dark:text-blue-300"
                        >
                          Duplicate
                        </button>
                      </form>
                      <form action={deleteAction}>
                        <input type="hidden" name="option_id" value={item.id} />
                        <input type="hidden" name="return_to" value={currentHref} />
                        <button
                          type="submit"
                          className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-500/16 dark:text-red-300"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
