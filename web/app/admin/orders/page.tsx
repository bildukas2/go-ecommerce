import Link from "next/link";
import { getAdminOrders } from "@/lib/api";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-semibold mb-2">Admin Not Configured</h1>
        <p className="text-sm text-gray-600">Set ADMIN_USER and ADMIN_PASS on the server, then reload this page.</p>
      </div>
    );
  }
  const page = parseInt(typeof searchParams?.page === "string" ? searchParams!.page : Array.isArray(searchParams?.page) ? searchParams!.page[0]! : "1", 10) || 1;
  const limit = parseInt(typeof searchParams?.limit === "string" ? searchParams!.limit : Array.isArray(searchParams?.limit) ? searchParams!.limit[0]! : "20", 10) || 20;
  const { items } = await getAdminOrders({ page, limit });
  const hasPrev = page > 1;
  const hasNext = items.length === limit; // heuristic without total count

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Page</span>
          <span className="font-medium">{page}</span>
          <div className="ml-4 flex gap-2">
            {hasPrev ? (
              <Link className="rounded border px-3 py-1 hover:bg-gray-50" href={`/admin/orders?page=${page - 1}&limit=${limit}`}>Prev</Link>
            ) : (
              <span className="rounded border px-3 py-1 text-gray-400">Prev</span>
            )}
            {hasNext ? (
              <Link className="rounded border px-3 py-1 hover:bg-gray-50" href={`/admin/orders?page=${page + 1}&limit=${limit}`}>Next</Link>
            ) : (
              <span className="rounded border px-3 py-1 text-gray-400">Next</span>
            )}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Number</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-2 font-mono">{o.number}</td>
                <td className="px-4 py-2">{o.status}</td>
                <td className="px-4 py-2">
                  {(o.total_cents / 100).toLocaleString(undefined, { style: "currency", currency: o.currency || "USD" })}
                </td>
                <td className="px-4 py-2">{new Date(o.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <Link className="text-blue-600 hover:underline" href={`/admin/orders/${encodeURIComponent(o.id)}`}>View</Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>No orders yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
