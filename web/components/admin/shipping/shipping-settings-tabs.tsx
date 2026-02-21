"use client";

import { useState } from "react";
import { Card } from "@heroui/react";
import { Zap, MapPin, Truck, Package } from "lucide-react";
import type { ShippingProvider, ShippingZone, ShippingMethod } from "@/lib/api";
import { ProvidersList } from "./providers-list";
import { ZonesList } from "./zones-list";

type TabType = "providers" | "zones" | "methods" | "terminals";

type Props = {
  initialProviders: ShippingProvider[];
  initialZones: ShippingZone[];
  initialMethods: ShippingMethod[];
};

const tabs: Array<{
  id: TabType;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "providers", label: "Providers", icon: <Zap size={18} /> },
  { id: "zones", label: "Zones", icon: <MapPin size={18} /> },
  { id: "methods", label: "Methods", icon: <Truck size={18} /> },
  { id: "terminals", label: "Terminals", icon: <Package size={18} /> },
];

export function ShippingSettingsTabs({
  initialProviders,
  initialZones,
  initialMethods,
}: Props) {
  const [currentTab, setCurrentTab] = useState<TabType>("providers");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 border-b border-surface-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            className={[
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative",
              currentTab === tab.id
                ? "text-foreground"
                : "text-foreground/60 hover:text-foreground/80",
            ].join(" ")}
            aria-selected={currentTab === tab.id}
            role="tab"
          >
            <span className={currentTab === tab.id ? "text-blue-500" : "text-foreground/60"}>
              {tab.icon}
            </span>
            {tab.label}
            {currentTab === tab.id && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600"
                aria-hidden
              />
            )}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-surface-border p-6">
        {currentTab === "providers" && (
          <ProvidersList initialProviders={initialProviders} />
        )}

        {currentTab === "zones" && (
          <ZonesList initialZones={initialZones} />
        )}

        {currentTab === "methods" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Shipping Methods</h2>
            <p className="text-foreground/70">Methods placeholder — Coming soon</p>
          </div>
        )}

        {currentTab === "terminals" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Terminals Cache</h2>
            <p className="text-foreground/70">Terminals placeholder — Coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
