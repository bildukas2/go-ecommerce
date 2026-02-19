import Link from "next/link";
import { getAdminCustomers } from "@/lib/api";
import { isUnauthorizedAdminError, parsePositiveIntParam } from "@/lib/admin-orders-state";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  if (!user || !pass) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-2 text-2xl font-semibold">Admin Not Configured</h1>
        <p className="text-sm text-gray-600">
          Set ADMIN_USER and ADMIN_PASS on the server, then reload this page.
        </p>
      </div>
    );
  }

  const page = parsePositiveIntParam(searchParams?.page, 1);
  const limit = parsePositiveIntParam(searchParams?.limit, 20);

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
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Page</span>
          <span className="font-medium">{page}</span>
          <div className="ml-4 flex gap-2">
            {hasPrev ? (
              <Link
                className="rounded border px-3 py-1 hover:bg-gray-50"
                href={`/admin/customers?page=${page - 1}&limit=${limit}`}
              >
                Prev
              </Link>
            ) : (
              <span className="rounded border px-3 py-1 text-gray-400">Prev</span>
            )}
            {hasNext ? (
              <Link
                className="rounded border px-3 py-1 hover:bg-gray-50"
                href={`/admin/customers?page=${page + 1}&limit=${limit}`}
              >
                Next
              </Link>
            ) : (
              <span className="rounded border px-3 py-1 text-gray-400">Next</span>
            )}
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((customer) => (
              <tr key={customer.id} className="border-t">
                <td className="px-4 py-2 font-mono">{customer.id}</td>
                <td className="px-4 py-2">{customer.email}</td>
                <td className="px-4 py-2">{new Date(customer.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">{new Date(customer.updated_at).toLocaleString()}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                  {fetchError ? "No customers loaded" : "No customers yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
