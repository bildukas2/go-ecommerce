import {
  getShippingProviders,
  getShippingZones,
  getShippingMethods,
} from "@/lib/api";
import { ShippingSettingsTabs } from "@/components/admin/shipping/shipping-settings-tabs";

export const dynamic = "force-dynamic";

async function fetchShippingData() {
  try {
    const [providers, zones, methods] = await Promise.all([
      getShippingProviders(),
      getShippingZones(),
      getShippingMethods(),
    ]);

    return {
      error: null,
      providers,
      zones,
      methods,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load shipping data",
      providers: [],
      zones: [],
      methods: [],
    };
  }
}

export default async function ShippingSettingsPage() {
  const data = await fetchShippingData();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Shipping Settings</h1>
        <p className="text-foreground/70">
          Configure shipping providers, zones, methods, and manage terminals cache
        </p>
      </div>

      {data.error && (
        <div className="rounded-2xl border border-red-200/50 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {data.error}
        </div>
      )}

      {!data.error && (
        <ShippingSettingsTabs
          initialProviders={data.providers}
          initialZones={data.zones}
          initialMethods={data.methods}
        />
      )}
    </div>
  );
}
