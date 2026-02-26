import { getPaymentMethods } from "@/lib/api";
import { PaymentMethodsList } from "@/components/admin/payments/payment-methods-list";

export const dynamic = "force-dynamic";

async function fetchPaymentMethods() {
  try {
    const methods = await getPaymentMethods();
    return {
      error: null,
      methods,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load payment methods",
      methods: [],
    };
  }
}

export default async function PaymentsSettingsPage() {
  const data = await fetchPaymentMethods();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Methods</h1>
        <p className="text-foreground/70">
          Configure payment methods available for customers during checkout
        </p>
      </div>

      {data.error && (
        <div className="rounded-2xl border border-red-200/50 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {data.error}
        </div>
      )}

      {!data.error && (
        <PaymentMethodsList initialMethods={data.methods} />
      )}
    </div>
  );
}
