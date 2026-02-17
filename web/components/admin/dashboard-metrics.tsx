import { DashboardMetrics as MetricsType } from "@/lib/api";

interface DashboardMetricsProps {
  metrics: MetricsType;
}

export function DashboardMetrics({ metrics }: DashboardMetricsProps) {
  const items = [
    {
      label: "Total Orders",
      value: metrics.total_orders,
      accent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
      ring: "ring-blue-500/20",
    },
    {
      label: "Pending Payment",
      value: metrics.pending_payment,
      accent: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      ring: "ring-amber-500/20",
    },
    {
      label: "Paid",
      value: metrics.paid,
      accent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      ring: "ring-emerald-500/20",
    },
    {
      label: "Cancelled",
      value: metrics.cancelled,
      accent: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
      ring: "ring-rose-500/20",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={[
            "glass glass-lift rounded-2xl p-5",
            "ring-1 shadow-[0_14px_30px_rgba(2,6,23,0.07)] dark:shadow-[0_18px_34px_rgba(2,6,23,0.35)]",
            item.ring,
          ].join(" ")}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground/75">{item.label}</p>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.accent}`}>
              Live
            </span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {item.value.toLocaleString()}
            </p>
            <p className="pb-1 text-xs text-foreground/60">orders</p>
          </div>
        </div>
      ))}
    </div>
  );
}
