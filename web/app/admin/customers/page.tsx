import Link from "next/link";
import { getAdminCustomers } from "@/lib/api";
import { isUnauthorizedAdminError, parsePositiveIntParam } from "@/lib/admin-orders-state";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, User, Calendar, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  if (!user || !pass) {
    return (
      <div className="mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="p-8 glass rounded-2xl border border-surface-border max-w-md">
          <h1 className="mb-3 text-2xl font-bold tracking-tight">Admin Not Configured</h1>
          <p className="text-sm text-foreground/70 mb-6">
            Set ADMIN_USER and ADMIN_PASS on the server, then reload this page.
          </p>
          <Button asChild variant="outline">
            <Link href="/admin">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const page = parsePositiveIntParam(params.page, 1);
  const limit = parsePositiveIntParam(params.limit, 20);

  let items: Awaited<ReturnType<typeof getAdminCustomers>>["items"] = [];
  let fetchError: string | null = null;

  try {
    const response = await getAdminCustomers({ page, limit });
    items = response.items;
  } catch (error) {
    if (isUnauthorizedAdminError(error)) {
      fetchError = "Unauthorized. Check ADMIN_USER and ADMIN_PASS server credentials.";
    } else {
      fetchError = "Failed to load customers. Please retry.";
    }
  }

  const hasPrev = page > 1;
  const hasNext = items.length === limit;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-foreground/70">
            View and manage your store&apos;s registered customers
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-surface-border bg-foreground/[0.03] px-3 py-1 text-sm font-medium">
            <span className="text-foreground/50">Page</span>
            <span>{page}</span>
          </div>
          <div className="flex gap-2">
            <Button
              asChild
              variant="secondary"
              size="icon"
              disabled={!hasPrev}
              className={`rounded-xl border border-surface-border bg-foreground/[0.03] ${!hasPrev ? "opacity-50 pointer-events-none" : ""}`}
            >
              {hasPrev ? (
                <Link href={`/admin/customers?page=${page - 1}&limit=${limit}`} aria-label="Previous page">
                  <ChevronLeft size={18} />
                </Link>
              ) : (
                <ChevronLeft size={18} />
              )}
            </Button>
            <Button
              asChild
              variant="secondary"
              size="icon"
              disabled={!hasNext}
              className={`rounded-xl border border-surface-border bg-foreground/[0.03] ${!hasNext ? "opacity-50 pointer-events-none" : ""}`}
            >
              {hasNext ? (
                <Link href={`/admin/customers?page=${page + 1}&limit=${limit}`} aria-label="Next page">
                  <ChevronRight size={18} />
                </Link>
              ) : (
                <ChevronRight size={18} />
              )}
            </Button>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {fetchError}
        </div>
      )}

      <div className="glass overflow-hidden rounded-2xl border text-foreground shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead>
              <tr className="border-b border-surface-border transition-colors">
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Customer</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Email</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Joined</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Last Updated</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-foreground/70">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-foreground/60">
                    <div className="flex flex-col items-center gap-2">
                      <User size={32} className="opacity-20" />
                      <p>{fetchError ? "Failed to load data" : "No customers found"}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-surface-border transition-colors hover:bg-foreground/[0.04]"
                  >
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/14 text-blue-600 dark:text-blue-300">
                          <User size={18} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold truncate max-w-[150px] md:max-w-xs">{customer.email.split('@')[0]}</span>
                          <span className="text-xs font-mono text-foreground/50 truncate">ID: {customer.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-2 text-foreground/80">
                        <Mail size={14} className="opacity-50" />
                        <span>{customer.email}</span>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-2 text-foreground/70">
                        <Calendar size={14} className="opacity-50" />
                        <span>
                          {new Date(customer.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 align-middle text-foreground/60">
                      {new Date(customer.updated_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-medium text-blue-600 hover:bg-blue-500/12 dark:text-blue-400"
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
