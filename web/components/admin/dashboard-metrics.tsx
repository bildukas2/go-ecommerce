import { DashboardMetrics as MetricsType } from "@/lib/api";

interface DashboardMetricsProps {
  metrics: MetricsType;
}

export function DashboardMetrics({ metrics }: DashboardMetricsProps) {
  const items = [
    { label: "Total Orders", value: metrics.total_orders, color: "text-blue-600" },
    { label: "Pending Payment", value: metrics.pending_payment, color: "text-yellow-600" },
    { label: "Paid", value: metrics.paid, color: "text-green-600" },
    { label: "Cancelled", value: metrics.cancelled, color: "text-red-600" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
