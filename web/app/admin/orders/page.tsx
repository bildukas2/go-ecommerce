import Link from "next/link";
import { getAdminOrders } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const { items } = await getAdminOrders({ page: 1, limit: 50 });
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Orders</h1>
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
