"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StorefrontFooter() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  // Do not show storefront footer on admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Logo & About */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="text-lg font-bold">go-ecommerce</Link>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
              Built for speed and modern commerce. Experience the future of online shopping.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">Shop</h4>
            <nav className="flex flex-col gap-2">
              <Link href="/products" className="text-sm text-neutral-500 hover:text-blue-500 dark:text-neutral-400 dark:hover:text-blue-400 transition-colors">All Products</Link>
              <Link href="/categories" className="text-sm text-neutral-500 hover:text-blue-500 dark:text-neutral-400 dark:hover:text-blue-400 transition-colors">Categories</Link>
            </nav>
          </div>

          {/* Support / Info */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">Info</h4>
            <nav className="flex flex-col gap-2">
              <Link href="/page/about-us" className="text-sm text-neutral-500 hover:text-blue-500 dark:text-neutral-400 dark:hover:text-blue-400 transition-colors">About Us</Link>
              <Link href="/page/shipping" className="text-sm text-neutral-500 hover:text-blue-500 dark:text-neutral-400 dark:hover:text-blue-400 transition-colors">Shipping Policy</Link>
            </nav>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-100 dark:border-neutral-900 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-neutral-400 dark:text-neutral-600">
            &copy; {currentYear} go-ecommerce. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/page/terms" className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-400">Terms</Link>
            <Link href="/page/privacy" className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-400">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
