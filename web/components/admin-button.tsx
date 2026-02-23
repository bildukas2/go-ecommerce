"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function AdminButton() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch("/admin/dashboard", {
          method: "GET",
          credentials: "include",
        });
        setIsAdmin(res.ok);
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
