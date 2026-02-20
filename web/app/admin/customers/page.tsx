import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import {
  createAdminCustomer,
  getAdminCustomerGroups,
  getAdminCustomers,
  updateAdminCustomer,
  updateAdminCustomerStatus,
  type AdminCustomerGroup,
  type AdminCustomerMutationInput,
  type AdminCustomerSummary,
} from "@/lib/api";
import { isUnauthorizedAdminError, parsePositiveIntParam } from "@/lib/admin-orders-state";
import { Button } from "@/components/ui/button";
import { CustomerStatusConfirmButton } from "@/components/admin/customer-status-confirm-button";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function messageHref(basePath: string, key: "notice" | "error", message: string): string {
  const path = basePath.startsWith("/admin/customers") ? basePath : "/admin/customers";
  const url = new URL(`http://localhost${path}`);
  url.searchParams.set(key, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/admin/customers";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/admin/customers")) return "/admin/customers";
  return trimmed;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

function asOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asRequiredString(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseCustomerMutationInput(formData: FormData): AdminCustomerMutationInput {
  const isAnonymous = String(formData.get("is_anonymous") ?? "").trim().toLowerCase() === "yes";
  const statusRaw = asRequiredString(formData.get("status")).toLowerCase();
  const status = statusRaw === "disabled" ? "disabled" : "active";
  const firstName = asRequiredString(formData.get("first_name"));
  const lastName = asRequiredString(formData.get("last_name"));

  return {
    email: isAnonymous ? null : asOptionalString(formData.get("email")),
    phone: asOptionalString(formData.get("phone")),
    first_name: firstName,
    last_name: lastName,
    status,
    group_id: asOptionalString(formData.get("group_id")),
    is_anonymous: isAnonymous,
    shipping_full_name: asRequiredString(formData.get("shipping_full_name")),
    shipping_phone: asRequiredString(formData.get("shipping_phone")),
    shipping_address1: asRequiredString(formData.get("shipping_address1")),
    shipping_address2: asRequiredString(formData.get("shipping_address2")),
    shipping_city: asRequiredString(formData.get("shipping_city")),
    shipping_state: asRequiredString(formData.get("shipping_state")),
    shipping_postcode: asRequiredString(formData.get("shipping_postcode")),
    shipping_country: asRequiredString(formData.get("shipping_country")),
    billing_full_name: asRequiredString(formData.get("billing_full_name")),
    billing_address1: asRequiredString(formData.get("billing_address1")),
    billing_address2: asRequiredString(formData.get("billing_address2")),
    billing_city: asRequiredString(formData.get("billing_city")),
    billing_state: asRequiredString(formData.get("billing_state")),
    billing_postcode: asRequiredString(formData.get("billing_postcode")),
    billing_country: asRequiredString(formData.get("billing_country")),
    company_name: asRequiredString(formData.get("company_name")),
    company_vat: asRequiredString(formData.get("company_vat")),
    invoice_email: asOptionalString(formData.get("invoice_email")),
    wants_invoice: String(formData.get("wants_invoice") ?? "").trim().toLowerCase() === "yes",
  };
}

function customerName(customer: AdminCustomerSummary): string {
  const full = `${customer.first_name} ${customer.last_name}`.trim();
  if (full) return full;
  if (customer.email) return customer.email;
  return "Anonymous customer";
}

function currentHref(params: {
  page: number;
  limit: number;
  q: string;
  group: string;
  status: string;
  anonymous: string;
  sort: string;
}): string {
  const url = new URL("http://localhost/admin/customers");
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("limit", String(params.limit));
  if (params.q) url.searchParams.set("q", params.q);
  if (params.group) url.searchParams.set("group", params.group);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.anonymous) url.searchParams.set("anonymous", params.anonymous);
  if (params.sort) url.searchParams.set("sort", params.sort);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function CustomerUpsertForm({
  customer,
  groups,
  submitText,
  action,
  returnTo,
}: {
  customer?: AdminCustomerSummary;
  groups: AdminCustomerGroup[];
  submitText: string;
  action: (formData: FormData) => Promise<void>;
  returnTo: string;
}) {
  const selectedGroupID = customer?.group_id ?? "";
  const selectedStatus = customer?.status ?? "active";
  const isAnonymous = customer?.is_anonymous ?? false;
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="return_to" value={returnTo} />
      {customer && <input type="hidden" name="customer_id" value={customer.id} />}
      <label className="space-y-1 text-xs">
        <span>First name</span>
        <input
          required
          name="first_name"
          defaultValue={customer?.first_name ?? ""}
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span>Last name</span>
        <input
          required
          name="last_name"
          defaultValue={customer?.last_name ?? ""}
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span>Email (required for registered)</span>
        <input
          name="email"
          type="email"
          defaultValue={customer?.email ?? ""}
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span>Phone</span>
        <input
          name="phone"
          defaultValue={customer?.phone ?? ""}
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span>Status</span>
        <select name="status" defaultValue={selectedStatus} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm">
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>
      <label className="space-y-1 text-xs">
        <span>Anonymous</span>
        <select
          name="is_anonymous"
          defaultValue={isAnonymous ? "yes" : "no"}
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
        >
          <option value="no">Registered</option>
          <option value="yes">Anonymous</option>
        </select>
      </label>
      <label className="space-y-1 text-xs">
        <span>Group</span>
        <select
          name="group_id"
          defaultValue={selectedGroupID}
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
        >
          <option value="">No group</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs">
        <span>Wants invoice</span>
        <select
          name="wants_invoice"
          defaultValue={customer?.wants_invoice ? "yes" : "no"}
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm"
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </label>

      <p className="md:col-span-2 text-xs font-semibold text-foreground/70">Shipping</p>
      <label className="space-y-1 text-xs">
        <span>Full name</span>
        <input name="shipping_full_name" defaultValue={customer?.shipping_full_name ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>Phone</span>
        <input name="shipping_phone" defaultValue={customer?.shipping_phone ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs md:col-span-2">
        <span>Address line 1</span>
        <input name="shipping_address1" defaultValue={customer?.shipping_address1 ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs md:col-span-2">
        <span>Address line 2</span>
        <input name="shipping_address2" defaultValue={customer?.shipping_address2 ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>City</span>
        <input name="shipping_city" defaultValue={customer?.shipping_city ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>State</span>
        <input name="shipping_state" defaultValue={customer?.shipping_state ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>Postcode</span>
        <input name="shipping_postcode" defaultValue={customer?.shipping_postcode ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>Country</span>
        <input name="shipping_country" defaultValue={customer?.shipping_country ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>

      <p className="md:col-span-2 text-xs font-semibold text-foreground/70">Billing & Invoice</p>
      <label className="space-y-1 text-xs">
        <span>Billing full name</span>
        <input name="billing_full_name" defaultValue={customer?.billing_full_name ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>Invoice email</span>
        <input name="invoice_email" type="email" defaultValue={customer?.invoice_email ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs md:col-span-2">
        <span>Billing address line 1</span>
        <input name="billing_address1" defaultValue={customer?.billing_address1 ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs md:col-span-2">
        <span>Billing address line 2</span>
        <input name="billing_address2" defaultValue={customer?.billing_address2 ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>Billing city</span>
        <input name="billing_city" defaultValue={customer?.billing_city ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>Billing state</span>
        <input name="billing_state" defaultValue={customer?.billing_state ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>Billing postcode</span>
        <input name="billing_postcode" defaultValue={customer?.billing_postcode ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>Billing country</span>
        <input name="billing_country" defaultValue={customer?.billing_country ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>Company name</span>
        <input name="company_name" defaultValue={customer?.company_name ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span>Company VAT / tax id</span>
        <input name="company_vat" defaultValue={customer?.company_vat ?? ""} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-sm" />
      </label>
      <button type="submit" className="md:col-span-2 rounded-xl border border-cyan-500/35 bg-cyan-500/12 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-500/18 dark:text-cyan-300">
        {submitText}
      </button>
    </form>
  );
}

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parsePositiveIntParam(params.page, 1);
  const limit = parsePositiveIntParam(params.limit, 20);
  const q = firstParam(params.q).trim();
  const group = firstParam(params.group).trim();
  const status = firstParam(params.status).trim();
  const anonymous = firstParam(params.anonymous).trim();
  const sort = firstParam(params.sort).trim() || "created_desc";
  const notice = firstParam(params.notice).trim();
  const actionError = firstParam(params.error).trim();

  const current = currentHref({ page, limit, q, group, status, anonymous, sort });

  const createCustomerAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    try {
      await createAdminCustomer(parseCustomerMutationInput(formData));
      revalidatePath("/admin/customers");
      redirect(messageHref(returnTo, "notice", "Customer created"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const updateCustomerAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const customerID = asRequiredString(formData.get("customer_id"));
    if (!customerID) {
      redirect(messageHref(returnTo, "error", "Missing customer id"));
    }
    try {
      await updateAdminCustomer(customerID, parseCustomerMutationInput(formData));
      revalidatePath("/admin/customers");
      redirect(messageHref(returnTo, "notice", "Customer updated"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const updateStatusAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const customerID = asRequiredString(formData.get("customer_id"));
    const nextStatusRaw = asRequiredString(formData.get("next_status")).toLowerCase();
    const nextStatus = nextStatusRaw === "disabled" ? "disabled" : "active";
    if (!customerID) {
      redirect(messageHref(returnTo, "error", "Missing customer id"));
    }
    try {
      await updateAdminCustomerStatus(customerID, nextStatus);
      revalidatePath("/admin/customers");
      redirect(messageHref(returnTo, "notice", `Customer ${nextStatus === "disabled" ? "disabled" : "enabled"}`));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  let items: AdminCustomerSummary[] = [];
  let total = 0;
  let groups: AdminCustomerGroup[] = [];
  let fetchError: string | null = null;
  try {
    const [customersResponse, groupsResponse] = await Promise.all([
      getAdminCustomers({
        page,
        limit,
        q,
        group: group || undefined,
        status: status === "active" || status === "disabled" ? status : undefined,
        anonymous: anonymous === "anonymous" || anonymous === "registered" ? anonymous : undefined,
        sort:
          sort === "created_asc" ||
          sort === "name_asc" ||
          sort === "name_desc" ||
          sort === "email_asc" ||
          sort === "email_desc" ||
          sort === "anonymous_asc" ||
          sort === "anonymous_desc"
            ? sort
            : "created_desc",
      }),
      getAdminCustomerGroups(),
    ]);
    items = customersResponse.items;
    total = customersResponse.total;
    groups = groupsResponse.items;
  } catch (error) {
    fetchError = isUnauthorizedAdminError(error)
      ? "Unauthorized. Check ADMIN_USER and ADMIN_PASS server credentials."
      : "Failed to load customers. Please retry.";
  }

  const hasPrev = page > 1;
  const hasNext = page * limit < total;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-foreground/70">Create, edit, group, and disable customers with shipping and invoice data.</p>
        </div>
      </div>

      {notice && <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div>}
      {(actionError || fetchError) && (
        <div className="rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {actionError || fetchError}
        </div>
      )}

      <section className="glass rounded-2xl border p-4">
        <details>
          <summary className="cursor-pointer list-none text-base font-semibold">Add customer</summary>
          <div className="mt-3">
            <CustomerUpsertForm groups={groups} submitText="Create customer" action={createCustomerAction} returnTo={current} />
          </div>
        </details>
      </section>

      <section className="glass rounded-2xl border p-4">
        <form method="GET" action="/admin/customers" className="grid gap-3 md:grid-cols-6">
          <input name="q" defaultValue={q} placeholder="Search email, name, phone" className="rounded-xl border border-surface-border bg-background px-3 py-2 text-sm md:col-span-2" />
          <select name="group" defaultValue={group} className="rounded-xl border border-surface-border bg-background px-3 py-2 text-sm">
            <option value="">All groups</option>
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className="rounded-xl border border-surface-border bg-background px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <select name="anonymous" defaultValue={anonymous} className="rounded-xl border border-surface-border bg-background px-3 py-2 text-sm">
            <option value="">All customers</option>
            <option value="registered">Registered only</option>
            <option value="anonymous">Anonymous only</option>
          </select>
          <select name="sort" defaultValue={sort} className="rounded-xl border border-surface-border bg-background px-3 py-2 text-sm">
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="email_asc">Email A-Z</option>
            <option value="email_desc">Email Z-A</option>
            <option value="anonymous_desc">Anonymous first</option>
            <option value="anonymous_asc">Registered first</option>
          </select>
          <input type="hidden" name="limit" value={String(limit)} />
          <Button type="submit" className="md:col-span-6 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            Apply Filters
          </Button>
        </form>
      </section>

      <section className="glass overflow-x-auto rounded-2xl border shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Group</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Anonymous</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-foreground/60">
                  <div className="flex flex-col items-center gap-2">
                    <UserRound size={30} className="opacity-25" />
                    <p>{fetchError ? "No customers loaded." : "No customers found for current filters."}</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((customer) => {
                const nextStatus = customer.status === "disabled" ? "active" : "disabled";
                return (
                  <tr key={customer.id} className="border-t border-surface-border align-top">
                    <td className="px-3 py-3 font-medium">{customerName(customer)}</td>
                    <td className="px-3 py-3">{customer.email ?? "-"}</td>
                    <td className="px-3 py-3">{customer.group_name ?? "-"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                          customer.status === "disabled"
                            ? "border-red-500/35 bg-red-500/12 text-red-700 dark:text-red-300"
                            : "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">{customer.is_anonymous ? "Yes" : "No"}</td>
                    <td className="px-3 py-3 text-xs text-foreground/70">
                      {new Date(customer.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-end gap-2">
                        <details className="group relative w-full">
                          <summary className="list-none">
                            <span className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-500/12 px-3 py-1.5 text-xs font-medium text-cyan-700 transition-colors hover:bg-cyan-500/18 dark:text-cyan-300">
                              View / Edit
                            </span>
                          </summary>
                          <div className="invisible absolute right-0 top-9 z-20 w-[min(56rem,90vw)] rounded-xl border border-surface-border bg-background p-3 opacity-0 shadow-2xl transition-all duration-150 group-open:visible group-open:opacity-100">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-semibold text-foreground/70">Edit customer</p>
                              <p className="text-xs text-foreground/60">{customerName(customer)}</p>
                            </div>
                            <div className="max-h-[70vh] overflow-auto pr-1">
                              <CustomerUpsertForm customer={customer} groups={groups} submitText="Save customer" action={updateCustomerAction} returnTo={current} />
                            </div>
                          </div>
                        </details>
                        <CustomerStatusConfirmButton
                          action={updateStatusAction}
                          customerID={customer.id}
                          nextStatus={nextStatus}
                          returnTo={current}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-foreground/60">Total customers: {total}</p>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm" disabled={!hasPrev} className={!hasPrev ? "pointer-events-none opacity-50" : ""}>
            <Link href={currentHref({ page: page - 1, limit, q, group, status, anonymous, sort })}>Previous</Link>
          </Button>
          <Button asChild variant="secondary" size="sm" disabled={!hasNext} className={!hasNext ? "pointer-events-none opacity-50" : ""}>
            <Link href={currentHref({ page: page + 1, limit, q, group, status, anonymous, sort })}>Next</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
