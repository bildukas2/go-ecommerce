"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminMe } from "@/lib/admin-auth";

export function AdminButton() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        await getAdminMe();
        setIsAdmin(true);
      } catch {
        setIsAdmin(false);
      } finally {
        setChecked(true);
      }
    };

    checkAdmin();
  }, []);

  if (!checked || !isAdmin) {
    return null;
  }

  return (
    <Link href="/admin" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
      Admin
    </Link>
  );
}
