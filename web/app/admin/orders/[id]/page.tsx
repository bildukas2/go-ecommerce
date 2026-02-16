import Link from "next/link";
import { getAdminOrder } from "@/lib/api";
import { isNotFoundAdminError, isUnauthorizedAdminError } from "@/lib/admin-orders-state";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: Params) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  if (!user || !pass) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-2 text-2xl font-semibold">Admin Not Configured</h1>
        <p className="text-sm text-gray-600">
          Set ADMIN_USER and ADMIN_PASS on the server, then reload this page.
        </p>
      </div>
    );
  }

  const { id } = await params;

  let order: Awaited<ReturnType<typeof getAdminOrder>> | null = null;
  let fetchError: string | null = null;

  try {
    order = await getAdminOrder(id);
  } catch (error) {
    if (isUnauthorizedAdminError(error)) {
      fetchError = "Unauthorized. Check ADMIN_USER and ADMIN_PASS server credentials.";
    } else if (isNotFoundAdminError(error)) {
      fetchError = "Order not found.";
    } else {
      fetchError = "Failed to fetch order. Please retry.";
    }
  }

  if (fetchError) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Order Detail</h1>
          <Link href="/admin/orders" className="text-blue-600 hover:underline">
            Back to orders
          </Link>
        </div>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Order Detail</h1>
          <Link href="/admin/orders" className="text-blue-600 hover:underline">
            Back to orders
          </Link>
        </div>
        <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          Order data is unavailable.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Order {order.Number}</h1>
        <Link href="/admin/orders" className="text-blue-600 hover:underline">
          Back to orders
        </Link>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border p-4">
          <h2 className="mb-2 font-medium">Summary</h2>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-gray-500">Status:</span> {order.Status}
            </div>
            <div>
              <span className="text-gray-500">Currency:</span> {order.Currency}
            </div>
            <div>
              <span className="text-gray-500">Subtotal:</span>{" "}
              {(order.SubtotalCents / 100).toLocaleString(undefined, {
                style: "currency",
                currency: order.Currency || "USD",
              })}
            </div>
            <div>
              <span className="text-gray-500">Shipping:</span>{" "}
              {(order.ShippingCents / 100).toLocaleString(undefined, {
                style: "currency",
                currency: order.Currency || "USD",
              })}
            </div>
            <div>
              <span className="text-gray-500">Tax:</span>{" "}
              {(order.TaxCents / 100).toLocaleString(undefined, {
                style: "currency",
                currency: order.Currency || "USD",
              })}
            </div>
            <div>
              <span className="text-gray-500">Total:</span>{" "}
              {(order.TotalCents / 100).toLocaleString(undefined, {
                style: "currency",
                currency: order.Currency || "USD",
              })}
            </div>
          </div>
        </div>
        <div className="rounded border p-4">
          <h2 className="mb-2 font-medium">Metadata</h2>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-gray-500">Order ID:</span> <span className="font-mono">{order.ID}</span>
            </div>
            <div>
              <span className="text-gray-500">Created:</span>{" "}
              {order.CreatedAt ? new Date(order.CreatedAt).toLocaleString() : "-"}
            </div>
            <div>
              <span className="text-gray-500">Updated:</span>{" "}
              {order.UpdatedAt ? new Date(order.UpdatedAt).toLocaleString() : "-"}
            </div>
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
                <td className="px-4 py-2">
                  {(it.UnitPriceCents / 100).toLocaleString(undefined, {
                    style: "currency",
                    currency: it.Currency || order.Currency || "USD",
                  })}
                </td>
                <td className="px-4 py-2">
                  {((it.UnitPriceCents * it.Quantity) / 100).toLocaleString(undefined, {
                    style: "currency",
                    currency: it.Currency || order.Currency || "USD",
                  })}
                </td>
              </tr>
            ))}
            {order.Items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                  No items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
