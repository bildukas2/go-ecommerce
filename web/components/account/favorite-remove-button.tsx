"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { removeAccountFavorite } from "@/lib/api";

type FavoriteRemoveButtonProps = {
  productID: string;
};

export function FavoriteRemoveButton({ productID }: FavoriteRemoveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onRemove() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await removeAccountFavorite(productID);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove favorite";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size="sm" onClick={onRemove} disabled={loading}>
        {loading ? "Removing..." : "Remove"}
      </Button>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
