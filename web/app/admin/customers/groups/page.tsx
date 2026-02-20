import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";
import {
  createAdminCustomerGroup,
  deleteAdminCustomerGroup,
  getAdminCustomerGroups,
  updateAdminCustomerGroup,
} from "@/lib/api";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function messageHref(basePath: string, key: "notice" | "error", message: string): string {
  const path = basePath.startsWith("/") ? basePath : "/admin/customers/groups";
  const url = new URL(`http://localhost${path}`);
  url.searchParams.set(key, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/admin/customers/groups";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/admin/customers/groups")) return "/admin/customers/groups";
  return trimmed;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

const SYSTEM_GROUP_CODE = "not-logged-in";

export default async function AdminCustomerGroupsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const notice = firstQueryValue(resolvedSearchParams.notice);
  const actionError = firstQueryValue(resolvedSearchParams.error);
  const currentHref = "/admin/customers/groups";

  const createGroupAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));

    try {
      await createAdminCustomerGroup({
        name: String(formData.get("name") ?? "").trim(),
        code: String(formData.get("code") ?? "").trim() || undefined,
      });
      revalidatePath("/admin/customers/groups");
      redirect(messageHref(returnTo, "notice", "Customer group created"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const updateGroupAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const groupID = String(formData.get("group_id") ?? "").trim();
    if (!groupID) redirect(messageHref(returnTo, "error", "Missing group id"));

    try {
      await updateAdminCustomerGroup(groupID, {
        name: String(formData.get("name") ?? "").trim(),
        code: String(formData.get("code") ?? "").trim() || undefined,
      });
      revalidatePath("/admin/customers/groups");
      redirect(messageHref(returnTo, "notice", "Customer group updated"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const deleteGroupAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const groupID = String(formData.get("group_id") ?? "").trim();
    const confirmDelete = String(formData.get("confirm_delete") ?? "").trim().toLowerCase() === "yes";
    if (!groupID) redirect(messageHref(returnTo, "error", "Missing group id"));
    if (!confirmDelete) redirect(messageHref(returnTo, "error", "Confirm group deletion before continuing"));

    try {
      await deleteAdminCustomerGroup(groupID);
      revalidatePath("/admin/customers/groups");
      redirect(messageHref(returnTo, "notice", "Customer group deleted"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  let items: Awaited<ReturnType<typeof getAdminCustomerGroups>>["items"] = [];
  let fetchError: string | null = null;
  try {
    const response = await getAdminCustomerGroups();
    items = response.items;
  } catch (error) {
    if (error instanceof Error && error.message.includes("401")) {
      fetchError = "Unauthorized. Please check your admin credentials.";
    } else {
      fetchError = "Failed to load customer groups. Please retry.";
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Groups</h1>
          <p className="text-sm text-foreground/70">Organize customers into manageable segments for admin operations.</p>
        </div>
      </div>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}
      {actionError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div>}
      {fetchError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}

      <section className="glass rounded-2xl border p-4 md:p-5">
        <details className="group">
          <summary className="cursor-pointer list-none text-lg font-semibold">
            <div className="flex items-center justify-between gap-3">
              <span>Add group</span>
              <span className="text-xs text-foreground/65 group-open:hidden">Open</span>
              <span className="hidden text-xs text-foreground/65 group-open:inline">Hide</span>
            </div>
          </summary>
          <form action={createGroupAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="return_to" value={currentHref} />
            <label className="space-y-1 text-sm">
              <span>Name</span>
              <input
                name="name"
                required
                placeholder="VIP"
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Code</span>
              <input
                name="code"
                placeholder="vip (leave empty to auto-generate from name)"
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="md:col-span-2 rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
            >
              Create group
            </button>
          </form>
        </details>
      </section>

      <section className="glass overflow-x-auto rounded-2xl border shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/70">
            <tr>
              <th className="px-3 py-2 font-medium">Group Name</th>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">System</th>
              <th className="px-3 py-2 font-medium">Customers count</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-foreground/60">
                  <div className="flex flex-col items-center gap-2">
                    <UsersRound size={28} className="opacity-25" />
                    <p>{fetchError ? "No groups loaded." : "No customer groups yet."}</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((group) => {
                const protectedGroup = group.code === SYSTEM_GROUP_CODE;
                return (
                  <tr key={group.id} className="border-t border-surface-border align-top">
                    <td className="px-3 py-3">
                      <p className="font-semibold">{group.name}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-foreground/70">{group.code}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          protectedGroup
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                            : "bg-slate-500/20 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {protectedGroup ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-3">{group.customer_count}</td>
                    <td className="px-3 py-3">
                      {protectedGroup ? (
                        <p className="text-right text-xs text-foreground/60">System group is locked</p>
                      ) : (
                        <div className="space-y-2">
                          <details className="rounded-lg border border-surface-border bg-foreground/[0.02] p-2">
                            <summary className="cursor-pointer text-right text-xs font-medium text-blue-700 dark:text-blue-300">Edit</summary>
                            <form action={updateGroupAction} className="mt-3 grid gap-2 text-sm">
                              <input type="hidden" name="return_to" value={currentHref} />
                              <input type="hidden" name="group_id" value={group.id} />
                              <label className="space-y-1">
                                <span>Name</span>
                                <input
                                  defaultValue={group.name}
                                  name="name"
                                  required
                                  className="w-full rounded-lg border border-surface-border bg-background px-3 py-2"
                                />
                              </label>
                              <label className="space-y-1">
                                <span>Code</span>
                                <input
                                  defaultValue={group.code}
                                  name="code"
                                  required
                                  className="w-full rounded-lg border border-surface-border bg-background px-3 py-2"
                                />
                              </label>
                              <button
                                type="submit"
                                className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-2 font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
                              >
                                Save changes
                              </button>
                            </form>
                          </details>
                          <form action={deleteGroupAction} className="rounded-lg border border-red-300/40 bg-red-500/[0.05] p-2">
                            <input type="hidden" name="return_to" value={currentHref} />
                            <input type="hidden" name="group_id" value={group.id} />
                            <label className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                              <input name="confirm_delete" type="checkbox" value="yes" className="mt-0.5 h-4 w-4 rounded border-red-400/50" />
                              <span>I confirm deleting this group.</span>
                            </label>
                            <button
                              type="submit"
                              className="mt-2 w-full rounded-lg border border-red-500/45 bg-red-500/14 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-300"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
