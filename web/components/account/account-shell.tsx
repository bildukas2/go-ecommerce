"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type AccountShellProps = {
  title: string;
  subtitle?: string;
  active: "overview" | "orders" | "favorites" | "settings";
  children: React.ReactNode;
};

export function AccountShell({ title, subtitle, active, children }: AccountShellProps) {
  const t = useTranslations("account.nav");

  const links: Array<{ key: AccountShellProps["active"]; href: string; labelKey: string }> = [
    { key: "overview", href: "/account", labelKey: "overview" },
    { key: "orders", href: "/account/orders", labelKey: "orders" },
    { key: "favorites", href: "/account/favorites", labelKey: "favorites" },
    { key: "settings", href: "/account/settings", labelKey: "settings" },
  ];

  return (
    <div className="hero-aurora mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-10 md:grid-cols-[220px_1fr]">
      <aside className="h-fit rounded-2xl border border-surface-border bg-surface p-3">
        <nav className="space-y-1">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                link.key === active
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "text-neutral-600 hover:bg-background/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
              }`}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="space-y-4">
        <div className="rounded-2xl border border-surface-border bg-surface p-5">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{subtitle}</p> : null}
        </div>
        {children}
      </section>
    </div>
  );
}
