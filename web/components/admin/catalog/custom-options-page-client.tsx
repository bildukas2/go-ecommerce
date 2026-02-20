import Link from "next/link";
import { Layers3 } from "lucide-react";
import { CustomOptionDeleteButton } from "@/components/admin/catalog/custom-option-delete-button";
import type { AdminCustomOption } from "@/lib/api";

const typeGroupOptions = [
  { value: "", label: "All types" },
  { value: "text", label: "Text" },
  { value: "file", label: "File" },
  { value: "select", label: "Select" },
  { value: "date", label: "Date" },
] as const;

type CustomOptionsPageClientProps = {
  notice: string;
  actionError: string;
  query: string;
  typeGroup: string;
  currentHref: string;
  items: AdminCustomOption[];
  fetchError: string | null;
  deleteAction: (formData: FormData) => Promise<void>;
  duplicateAction: (formData: FormData) => Promise<void>;
};

function typeGroupLabel(typeGroup: AdminCustomOption["type_group"]): string {
  return typeGroup.slice(0, 1).toUpperCase() + typeGroup.slice(1);
}

function updatedLabel(value?: string): string {
  const parsed = Date.parse(value ?? "");
  if (!Number.isFinite(parsed)) return "Unknown";
  return new Date(parsed).toLocaleString();
}

export function CustomOptionsPageClient({
  notice,
  actionError,
  query,
  typeGroup,
  currentHref,
  items,
  fetchError,
  deleteAction,
  duplicateAction,
}: CustomOptionsPageClientProps) {
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
        <form method="get" action="/admin/catalog/custom-options" className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
          <label className="space-y-1 text-sm">
            <span className="text-foreground/70">Search</span>
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

      {items.length === 0 ? (
        <div className="rounded-2xl border border-surface-border bg-background p-8 text-center shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-cyan-400/35 bg-cyan-400/10 text-cyan-700">
            <Layers3 size={20} />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No customizable options yet</h2>
          <p className="mt-1 text-sm text-foreground/70">
            {fetchError ? "No options loaded right now." : "No customizable options match the current filters."}
          </p>
          <div className="mt-5">
            <Link
              href="/admin/catalog/custom-options/new"
              className="rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18"
            >
              Create option
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-surface-border bg-background shadow-sm">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-foreground/[0.02] text-left text-foreground/65">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Required</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-surface-border/80">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{item.title}</p>
                    <p className="font-mono text-xs text-foreground/60">{item.code}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{typeGroupLabel(item.type_group)}</span>
                      <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium text-foreground/80">{item.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{item.required ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-foreground/75">{updatedLabel(item.updated_at)}</td>
                  <td className="px-4 py-3">
                    <span className={item.is_active ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700" : "rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium text-foreground/70"}>
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/catalog/custom-options/${item.id}`}
                        className="rounded-lg border border-surface-border bg-foreground/[0.02] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
                      >
                        Edit
                      </Link>
                      <form action={duplicateAction}>
                        <input type="hidden" name="option_id" value={item.id} />
                        <input type="hidden" name="return_to" value={currentHref} />
                        <button
                          type="submit"
                          className="rounded-lg border border-surface-border bg-foreground/[0.02] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
                        >
                          Duplicate
                        </button>
                      </form>
                      <CustomOptionDeleteButton action={deleteAction} optionID={item.id} returnTo={currentHref} optionTitle={item.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
