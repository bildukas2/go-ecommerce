"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { refreshShippingTerminals } from "@/lib/api";

type Props = {
  provider: string;
  country: string;
  onSuccess?: (entry: { provider: string; country: string; terminalCount: number; fetchedAt: string }) => void;
  onError?: (error: string) => void;
};

export function TerminalsRefreshButton({ provider, country, onSuccess, onError }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const result = await refreshShippingTerminals(provider, country);
      onSuccess?.({
        provider: result.provider,
        country: result.country,
        terminalCount: result.terminals.length,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isLoading}
      title="Refresh terminals cache"
      aria-label="Refresh terminals cache"
      className="inline-flex size-8 items-center justify-center rounded-lg border border-blue-500/35 bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 disabled:opacity-50 dark:text-blue-300"
    >
      <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
    </button>
  );
}
