"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { CartButton, CartDrawer } from "@/components/cart-drawer";
import { LogoutButton } from "@/components/account/logout-button";
import { AdminButton } from "@/components/admin-button";
import type { StorefrontNavigationItem } from "@/lib/api";
import { Menu, X } from "lucide-react";

type StorefrontHeaderProps = {
  isAuthenticated: boolean;
  mobileItems?: StorefrontNavigationItem[];
};

export function StorefrontHeader({ isAuthenticated, mobileItems = [] }: StorefrontHeaderProps) {
  const t = useTranslations("header.menu");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  
  // Do not show storefront header on admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <>
      <header className="relative z-40 border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold">go-ecommerce</Link>
          <nav className="hidden md:flex items-center gap-3">
            <Link href="/products" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
              {t("products")}
            </Link>
            <AdminButton />
            {isAuthenticated ? (
              <>
                <Link href="/account" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                  {t("account")}
                </Link>
                <LogoutButton className="h-8 px-2 text-sm" />
              </>
            ) : (
              <>
                <Link href="/account/login" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                  {t("login")}
                </Link>
                <Link href="/account/register" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                  {t("register")}
                </Link>
              </>
            )}
            <ThemeToggle />
            <LocaleSwitcher />
            <CartButton />
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <LocaleSwitcher />
            <CartButton />
            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="md:hidden border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <nav className="mx-auto max-w-6xl px-6 py-4 flex flex-col gap-3">
            {mobileItems.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href as any}
                target={item.open_in_new_tab ? "_blank" : undefined}
                rel={item.open_in_new_tab ? "noopener noreferrer" : undefined}
                className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline"
                onClick={closeMobileMenu}
              >
                {item.label}
              </Link>
            ))}
            <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-1" />
            <Link href="/products" className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline" onClick={closeMobileMenu}>
              {t("products")}
            </Link>
            <AdminButton />
            {isAuthenticated ? (
              <>
                <Link href="/account" className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline" onClick={closeMobileMenu}>
                  {t("account")}
                </Link>
                <LogoutButton className="h-8 px-2 text-sm justify-start w-fit" />
              </>
            ) : (
              <>
                <Link href="/account/login" className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline" onClick={closeMobileMenu}>
                  {t("login")}
                </Link>
                <Link href="/account/register" className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline" onClick={closeMobileMenu}>
                  {t("register")}
                </Link>
              </>
            )}
          </nav>
        </div>
      ) : null}

      <CartDrawer />
    </>
  );
}
