"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import type { StorefrontNavigationItem } from "@/lib/api";

type Props = {
  shopItems?: StorefrontNavigationItem[];
  infoItems?: StorefrontNavigationItem[];
};

function FooterLinks({ items }: { items: StorefrontNavigationItem[] }) {
  const t = useTranslations("footer");
  if (items.length === 0) {
    return <p className="text-sm text-neutral-400 dark:text-neutral-600">{t("no_links")}</p>;
  }

  return (
    <nav className="flex flex-col gap-2">
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.label}`}
          href={item.href as any}
          target={item.open_in_new_tab ? "_blank" : undefined}
          rel={item.open_in_new_tab ? "noopener noreferrer" : undefined}
          className="text-sm text-neutral-500 hover:text-blue-500 dark:text-neutral-400 dark:hover:text-blue-400 transition-colors"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function StorefrontFooter({ shopItems = [], infoItems = [] }: Props) {
  const t = useTranslations("footer");
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
              {t("about_text")}
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">{t("columns.shop")}</h4>
            <FooterLinks items={shopItems} />
          </div>

          {/* Support / Info */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">{t("columns.info")}</h4>
            <FooterLinks items={infoItems} />
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-100 dark:border-neutral-900 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-neutral-400 dark:text-neutral-600">
            &copy; {currentYear} go-ecommerce. {t("rights")}
          </p>
          <div className="flex gap-6">
            <Link href="/page/terms" className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-400">{t("links.terms")}</Link>
            <Link href="/page/privacy" className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-400">{t("links.privacy")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
