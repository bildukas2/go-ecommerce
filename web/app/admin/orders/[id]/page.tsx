import Link from "next/link";
import { getAdminOrder } from "@/lib/api";

type Params = { params: { id: string } };

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: Params) {
  const order = await getAdminOrder(params.id);
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Order {order.Number}</h1>
        <Link href="/admin/orders" className="text-blue-600 hover:underline">Back to orders</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded border p-4">
          <h2 className="font-medium mb-2">Summary</h2>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-500">Status:</span> {order.Status}</div>
            <div><span className="text-gray-500">Currency:</span> {order.Currency}</div>
            <div><span className="text-gray-500">Subtotal:</span> {(order.SubtotalCents / 100).toLocaleString(undefined, { style: "currency", currency: order.Currency || "USD" })}</div>
            <div><span className="text-gray-500">Shipping:</span> {(order.ShippingCents / 100).toLocaleString(undefined, { style: "currency", currency: order.Currency || "USD" })}</div>
            <div><span className="text-gray-500">Tax:</span> {(order.TaxCents / 100).toLocaleString(undefined, { style: "currency", currency: order.Currency || "USD" })}</div>
            <div><span className="text-gray-500">Total:</span> {(order.TotalCents / 100).toLocaleString(undefined, { style: "currency", currency: order.Currency || "USD" })}</div>
          </div>
        </div>
        <div className="rounded border p-4">
          <h2 className="font-medium mb-2">Metadata</h2>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-500">Order ID:</span> <span className="font-mono">{order.ID}</span></div>
            <div><span className="text-gray-500">Created:</span> {order.CreatedAt ? new Date(order.CreatedAt).toLocaleString() : "-"}</div>
            <div><span className="text-gray-500">Updated:</span> {order.UpdatedAt ? new Date(order.UpdatedAt).toLocaleString() : "-"}</div>
          </div>
        </div>
      </div>
      <div className="rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Variant</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {order.Items.map((it) => (
              <tr key={it.ID} className="border-t">
                <td className="px-4 py-2 font-mono">{it.ProductVariantID}</td>
                <td className="px-4 py-2">{it.Quantity}</td>
                <td className="px-4 py-2">{(it.UnitPriceCents / 100).toLocaleString(undefined, { style: "currency", currency: it.Currency || order.Currency || "USD" })}</td>
                <td className="px-4 py-2">{((it.UnitPriceCents * it.Quantity) / 100).toLocaleString(undefined, { style: "currency", currency: it.Currency || order.Currency || "USD" })}</td>
              </tr>
            ))}
            {order.Items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>No items</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
