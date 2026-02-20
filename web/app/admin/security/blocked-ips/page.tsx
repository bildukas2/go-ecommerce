import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Ban, ShieldAlert } from "lucide-react";
import { createAdminBlockedIP, deleteAdminBlockedIP, getAdminBlockedIPs } from "@/lib/api";
import { isUnauthorizedAdminError } from "@/lib/admin-orders-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function messageHref(basePath: string, kind: "notice" | "error", value: string): string {
  const path = basePath.startsWith("/admin/security/blocked-ips") ? basePath : "/admin/security/blocked-ips";
  const url = new URL(`http://localhost${path}`);
  url.searchParams.set(kind, value);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/admin/security/blocked-ips";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/admin/security/blocked-ips")) return "/admin/security/blocked-ips";
  return trimmed;
}

export default async function AdminBlockedIPsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const notice = firstParam(resolvedSearchParams.notice);
  const actionError = firstParam(resolvedSearchParams.error);
  const currentHref = "/admin/security/blocked-ips";

  const createBlockAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const ip = String(formData.get("ip") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const expiresAt = String(formData.get("expires_at") ?? "").trim();

    try {
      await createAdminBlockedIP({
        ip,
        reason: reason || null,
        expires_at: expiresAt || null,
      });
      revalidatePath("/admin/security/blocked-ips");
      redirect(messageHref(returnTo, "notice", "IP blocked"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to block IP";
      redirect(messageHref(returnTo, "error", message));
    }
  };

  const deleteBlockAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      redirect(messageHref(returnTo, "error", "Missing blocked IP id"));
    }
    try {
      await deleteAdminBlockedIP(id);
      revalidatePath("/admin/security/blocked-ips");
      redirect(messageHref(returnTo, "notice", "IP unblocked"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to unblock IP";
      redirect(messageHref(returnTo, "error", message));
    }
  };

  let items: Awaited<ReturnType<typeof getAdminBlockedIPs>>["items"] = [];
  let fetchError: string | null = null;
  try {
    const response = await getAdminBlockedIPs();
    items = response.items;
  } catch (error) {
    fetchError = isUnauthorizedAdminError(error)
      ? "Unauthorized. Check ADMIN_USER and ADMIN_PASS server credentials."
      : "Failed to load blocked IPs. Please retry.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blocked IPs</h1>
          <p className="text-sm text-foreground/70">Manage temporary/permanent IP blocks for storefront security.</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/customers/logs">Open Customer Logs</Link>
        </Button>
      </div>

      {notice && <p className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {(actionError || fetchError) && (
        <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {actionError || fetchError}
        </p>
      )}

      <section className="glass rounded-2xl border p-4">
        <form action={createBlockAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="return_to" value={currentHref} />
          <label className="space-y-1 text-sm">
            <span>IP Address</span>
            <input
              name="ip"
              required
              placeholder="203.0.113.10"
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Reason (optional)</span>
            <input
              name="reason"
              placeholder="bot abuse"
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Expires At (optional)</span>
            <input
              name="expires_at"
              type="datetime-local"
              className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="md:col-span-3 rounded-xl border border-cyan-500/35 bg-cyan-500/12 px-4 py-2 text-sm font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/18 dark:text-cyan-300"
          >
            Add Block
          </button>
        </form>
      </section>

      <section className="glass overflow-x-auto rounded-2xl border shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
            <tr>
              <th className="px-3 py-2 font-medium">IP</th>
              <th className="px-3 py-2 font-medium">Reason</th>
              <th className="px-3 py-2 font-medium">Expires</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-foreground/60">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldAlert size={30} className="opacity-30" />
                    <p>{fetchError ? "No blocked IPs loaded." : "No blocked IPs configured."}</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-surface-border">
                  <td className="px-3 py-3 font-mono text-xs">{item.ip}</td>
                  <td className="px-3 py-3">{item.reason ?? "-"}</td>
                  <td className="px-3 py-3 text-xs text-foreground/70">
                    {item.expires_at ? new Date(item.expires_at).toLocaleString() : "Never"}
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground/70">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="px-3 py-3 text-right">
                    <form action={deleteBlockAction}>
                      <input type="hidden" name="return_to" value={currentHref} />
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/12 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-500/20 dark:text-red-300"
                      >
                        <Ban size={12} />
                        Unblock
                      </button>
                    </form>
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
