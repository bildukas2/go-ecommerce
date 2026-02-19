"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { logoutAccount } from "@/lib/api";

type LogoutButtonProps = {
  variant?: "default" | "secondary" | "outline" | "ghost";
  className?: string;
};

export function LogoutButton({ variant = "ghost", className }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await logoutAccount();
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant={variant} className={className} onClick={onLogout} disabled={loading}>
      {loading ? "Logging out..." : "Logout"}
    </Button>
  );
}
