/**
 * StorefrontHeader override template — user-owned safe zone.
 *
 * HOW TO USE:
 * 1. Copy this file:
 *      cp web/theme/overrides/components/StorefrontHeader.example.tsx \
 *         web/theme/overrides/components/StorefrontHeader.tsx
 *
 * 2. Add to web/theme/overrides/components/index.ts:
 *      export { StorefrontHeader } from "./StorefrontHeader";
 *
 * 3. Edit freely. Core files untouched.
 */

"use client";

import type { StorefrontNavigationItem } from "@/lib/api";

type StorefrontHeaderProps = {
  isAuthenticated: boolean;
  mobileItems?: StorefrontNavigationItem[];
};

export function StorefrontHeader({ isAuthenticated }: StorefrontHeaderProps) {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <span className="font-semibold">My Store</span>
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <a href="/account" className="text-sm hover:underline">Account</a>
          ) : (
            <a href="/account/login" className="text-sm hover:underline">Login</a>
          )}
        </nav>
      </div>
    </header>
  );
}
