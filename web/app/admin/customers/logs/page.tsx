import Link from "next/link";
import { FileSearch, ShieldAlert } from "lucide-react";
import { getAdminCustomerActionLogs } from "@/lib/api";
import { isUnauthorizedAdminError, parsePositiveIntParam } from "@/lib/admin-orders-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function nextHref(
  page: number,
  limit: number,
  q: string,
  action: string,
  from: string,
  to: string,
  detail: string,
): string {
  const url = new URL("http://localhost/admin/customers/logs");
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  if (q) url.searchParams.set("q", q);
  if (action) url.searchParams.set("action", action);
  if (from) url.searchParams.set("from", from);
  if (to) url.searchParams.set("to", to);
  if (detail) url.searchParams.set("detail", detail);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function severityClasses(severity: string | null): string {
  if (severity === "security") return "border-red-500/35 bg-red-500/12 text-red-700 dark:text-red-300";
  if (severity === "warn") return "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300";
  return "border-cyan-500/35 bg-cyan-500/12 text-cyan-700 dark:text-cyan-300";
}

export default async function AdminCustomerActionLogsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parsePositiveIntParam(params.page, 1);
  const limit = parsePositiveIntParam(params.limit, 20);
  const q = firstParam(params.q).trim();
  const action = firstParam(params.action).trim();
  const from = firstParam(params.from).trim();
  const to = firstParam(params.to).trim();
  const detail = firstParam(params.detail).trim();

  let items: Awaited<ReturnType<typeof getAdminCustomerActionLogs>>["items"] = [];
  let total = 0;
  let fetchError: string | null = null;
  try {
    const response = await getAdminCustomerActionLogs({ page, limit, q, action, from, to });
    items = response.items;
    total = response.total;
  } catch (error) {
    fetchError = isUnauthorizedAdminError(error)
      ? "Unauthorized. Check ADMIN_USER and ADMIN_PASS server credentials."
      : "Failed to load action logs. Please retry.";
  }

  const hasPrev = page > 1;
  const hasNext = page * limit < total;
  const selected = detail ? items.find((item) => item.id === detail) ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Action Logs</h1>
          <p className="text-sm text-foreground/70">Track customer/admin/security events with IP and metadata.</p>
        </div>
      </div>

      <section className="glass rounded-2xl border p-4">
        <form method="GET" action="/admin/customers/logs" className="grid gap-3 md:grid-cols-5">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email, action, or IP"
            className="rounded-xl border border-surface-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            name="action"
            defaultValue={action}
            placeholder="Action (e.g. customer.created)"
            className="rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
          />
          <input name="from" type="date" defaultValue={from} className="rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
          <input name="to" type="date" defaultValue={to} className="rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
          <input type="hidden" name="limit" value={String(limit)} />
          <Button type="submit" className="md:col-span-5 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            Apply Filters
          </Button>
        </form>
      </section>

      {fetchError && <div className="rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{fetchError}</div>}

      <section className="glass overflow-x-auto rounded-2xl border shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">IP</th>
              <th className="px-3 py-2 font-medium">Severity</th>
              <th className="px-3 py-2 font-medium text-right">Meta</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-foreground/60">
                  <div className="flex flex-col items-center gap-2">
                    <FileSearch size={30} className="opacity-30" />
                    <p>{fetchError ? "No logs loaded." : "No customer action logs found."}</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-surface-border">
                  <td className="px-3 py-3 text-xs text-foreground/70">
                    {new Date(item.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{item.action}</td>
                  <td className="px-3 py-3">{item.customer_email ?? "anonymous"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{item.ip}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${severityClasses(item.severity)}`}>
                      {item.severity ?? "info"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button asChild size="sm" variant="ghost" className="text-cyan-700 hover:bg-cyan-500/12 dark:text-cyan-300">
                      <Link href={nextHref(page, limit, q, action, from, to, item.id)}>View JSON</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-foreground/60">Total logs: {total}</p>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm" disabled={!hasPrev} className={!hasPrev ? "pointer-events-none opacity-50" : ""}>
            <Link href={nextHref(page - 1, limit, q, action, from, to, detail)}>Previous</Link>
          </Button>
          <Button asChild variant="secondary" size="sm" disabled={!hasNext} className={!hasNext ? "pointer-events-none opacity-50" : ""}>
            <Link href={nextHref(page + 1, limit, q, action, from, to, detail)}>Next</Link>
          </Button>
        </div>
      </div>

      {selected && (
        <section className="glass rounded-2xl border p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert size={16} className="text-cyan-600 dark:text-cyan-300" />
            <h2 className="text-lg font-semibold">Log Detail</h2>
          </div>
          <pre className="overflow-auto rounded-xl border border-surface-border bg-foreground/[0.03] p-3 text-xs leading-6">
            {JSON.stringify(selected.meta_json, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

