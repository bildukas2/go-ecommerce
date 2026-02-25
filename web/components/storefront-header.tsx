"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { CartButton, CartDrawer } from "@/components/cart-drawer";
import { LogoutButton } from "@/components/account/logout-button";
import { AdminButton } from "@/components/admin-button";

export function StorefrontHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  
  // Do not show storefront header on admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      <header className="relative z-40 border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold">go-ecommerce</Link>
          <nav className="flex items-center gap-3">
            <Link href="/products" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Products</Link>
            <AdminButton />
            {isAuthenticated ? (
              <>
                <Link href="/account" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Account</Link>
                <LogoutButton className="h-8 px-2 text-sm" />
              </>
            ) : (
              <>
                <Link href="/account/login" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Login</Link>
                <Link href="/account/register" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Register</Link>
              </>
            )}
            <ThemeToggle />
            <CartButton />
          </nav>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}
