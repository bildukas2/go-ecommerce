import { getAdminPages, deleteAdminPage } from "@/lib/api";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PagesTable } from "@/components/admin/cms/pages-table";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function AdminPagesPage({ 
  searchParams 
}: { 
  searchParams: Promise<SearchParams> 
}) {
  const sp = await searchParams;
  const query = typeof sp.query === "string" ? sp.query : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = typeof sp.page === "string" ? parseInt(sp.page, 10) : 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const { pages, total } = await getAdminPages({ query, status, limit, offset });

  async function deletePageAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) return;
    try {
      await deleteAdminPage(id);
      revalidatePath("/admin/cms/pages");
    } catch (error) {
      console.error("Failed to delete page:", error);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pages</h1>
          <p className="text-sm text-foreground/60">Manage your store's static pages</p>
        </div>
        <Link
          href="/admin/cms/pages/new"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Page
        </Link>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-content1 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form className="relative flex-1 sm:max-w-xs">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search size={18} className="text-foreground/40" />
              </div>
              <input
                type="text"
                name="query"
                placeholder="Search pages..."
                defaultValue={query}
                className="block w-full rounded-xl border border-surface-border bg-background py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </form>
          <div className="flex items-center gap-2">
            {/* Status filters could go here */}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-surface-border">
          <PagesTable 
            pages={pages} 
            deleteAction={deletePageAction} 
          />
        </div>

        {total > limit && (
          <div className="flex items-center justify-between border-t border-surface-border pt-4">
            <p className="text-sm text-foreground/60">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} pages
            </p>
            <div className="flex gap-2">
              <Link
                href={`/admin/cms/pages?page=${page - 1}&query=${query}&status=${status}`}
                className={`rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5 ${
                  page <= 1 ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Previous
              </Link>
              <Link
                href={`/admin/cms/pages?page=${page + 1}&query=${query}&status=${status}`}
                className={`rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5 ${
                  offset + limit >= total ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
