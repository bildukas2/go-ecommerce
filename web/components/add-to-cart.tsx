"use client";

import * as React from "react";
import { ensureCart } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-context";

export function AddToCartButton() {
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string>("");
  const { openDrawer } = useCart();

  async function onClick() {
    setStatus("loading");
    setMessage("");
    try {
      await ensureCart();
      setStatus("done");
      setMessage("Cart ready. Opened drawer.");
      openDrawer();
    } catch {
      setStatus("error");
      setMessage("Failed to prepare cart. Please try again.");
    }
  }

  return (
    <div>
      <Button onClick={onClick} disabled={status === "loading"}>
        {status === "loading" ? "Preparing…" : "Add to Cart"}
      </Button>
      {message && (
        <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{message}</div>
      )}
    </div>
  );
}
