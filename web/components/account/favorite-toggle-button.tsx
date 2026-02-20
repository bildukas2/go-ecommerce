"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Heart } from "lucide-react";
import { addAccountFavorite } from "@/lib/api";

type FavoriteToggleButtonProps = {
  productID: string;
  nextPathOnLogin?: string;
};

export function FavoriteToggleButton({ productID, nextPathOnLogin = "/" }: FavoriteToggleButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onFavorite() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      await addAccountFavorite(productID);
      setStatus("Saved to favorites");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save favorite";
      if (message.toLowerCase().includes("unauthorized")) {
        router.push(`/account/login?next=${encodeURIComponent(nextPathOnLogin)}`);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="bordered"
        radius="lg"
        className="w-full border-blue-500/45 bg-blue-500/10 font-medium text-blue-700 hover:bg-blue-500/20 dark:text-blue-300"
        onPress={onFavorite}
        isDisabled={loading}
        startContent={<Heart size={17} aria-hidden />}
      >
        {loading ? "Saving..." : "Save to Favorites"}
      </Button>
      {status ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{status}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
