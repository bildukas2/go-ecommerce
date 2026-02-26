"use client";

import { Link } from "@/i18n/routing";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button, Input } from "@heroui/react";
import { ChevronDown, Compass, CreditCard, FileText, FolderTree, ImageIcon, Languages, LayoutDashboard, List, Mail, Menu, Search, ShieldAlert, ShoppingCart, SlidersHorizontal, Store, Truck, Users, UsersRound, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAdminCSRFToken, logoutAdmin } from "@/lib/admin-auth";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
};

const DESKTOP_EXPANDED_WIDTH = 280;
const DESKTOP_COLLAPSED_WIDTH = 88;

const navItems: NavItem[] = [
  { href: "/admin", labelKey: "dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/admin/orders", labelKey: "orders", icon: <ShoppingCart size={18} /> },
];

const catalogItems: NavItem[] = [
  { href: "/admin/catalog/categories", labelKey: "categories", icon: <FolderTree size={16} /> },
  { href: "/admin/catalog/products", labelKey: "products", icon: <ShoppingCart size={16} /> },
  { href: "/admin/catalog/custom-options", labelKey: "custom_options", icon: <SlidersHorizontal size={16} /> },
];

const cmsItems: NavItem[] = [
  { href: "/admin/cms/pages", labelKey: "pages", icon: <FileText size={16} /> },
  { href: "/admin/cms/navigation/menus", labelKey: "navigation", icon: <Compass size={16} /> },
];

const customerItems: NavItem[] = [
  { href: "/admin/customers", labelKey: "customers_list", icon: <Users size={16} /> },
  { href: "/admin/customers/logs", labelKey: "customer_logs", icon: <List size={16} /> },
  { href: "/admin/customers/groups", labelKey: "customer_groups", icon: <UsersRound size={16} /> },
  { href: "/admin/security/blocked-ips", labelKey: "security", icon: <ShieldAlert size={16} /> },
];

const mediaItems: NavItem[] = [
  { href: "/admin/media/images", labelKey: "images", icon: <ImageIcon size={16} /> },
  { href: "/admin/media/video", labelKey: "video", icon: <Video size={16} /> },
];

const settingsItems: NavItem[] = [
  { href: "/admin/settings/shipping", labelKey: "shipping", icon: <Truck size={16} /> },
  { href: "/admin/settings/payments", labelKey: "payments", icon: <CreditCard size={16} /> },
];

const emailItems: NavItem[] = [
  { href: "/admin/email/settings", labelKey: "email_settings", icon: <Mail size={16} /> },
  { href: "/admin/email/templates", labelKey: "email_templates", icon: <FileText size={16} /> },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isCustomersSubItemActive(pathname: string, href: string): boolean {
  if (href === "/admin/customers") {
    return pathname === href;
  }

  return isActivePath(pathname, href);
}

function SidebarNav({
  collapsed,
  pathname,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("admin.menu");
  const catalogActive = pathname.startsWith("/admin/catalog");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const isCatalogExpanded = catalogOpen;
  const cmsActive = pathname.startsWith("/admin/cms");
  const [cmsOpen, setCmsOpen] = useState(false);
  const isCmsExpanded = cmsActive || cmsOpen;
  const mediaActive = pathname.startsWith("/admin/media");
  const [mediaOpen, setMediaOpen] = useState(false);
  const isMediaExpanded = mediaActive || mediaOpen;
  const settingsActive = pathname.startsWith("/admin/settings");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isSettingsExpanded = settingsActive || settingsOpen;
  const emailActive = pathname.startsWith("/admin/email");
  const [emailOpen, setEmailOpen] = useState(false);
  const isEmailExpanded = emailActive || emailOpen;
  const customersActive = pathname.startsWith("/admin/customers") || pathname.startsWith("/admin/security");
  const [customersOpen, setCustomersOpen] = useState(false);
  const isCustomersExpanded = customersOpen;

  useEffect(() => {
    if (catalogActive) setCatalogOpen(true);
    if (cmsActive) setCmsOpen(true);
    if (mediaActive) setMediaOpen(true);
    if (emailActive) setEmailOpen(true);
  }, [catalogActive, cmsActive, mediaActive, emailActive]);

  return (
    <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Admin navigation">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const label = t(item.labelKey);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-label={label}
            className={[
              "group flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
              active
                ? "border-blue-500/30 bg-blue-500/12 text-foreground"
                : "border-transparent text-foreground/80 hover:border-surface-border hover:bg-foreground/5",
            ].join(" ")}
          >
            <motion.span
              className={active ? "text-blue-500" : "text-foreground/70 group-hover:text-blue-500"}
              animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              {item.icon}
            </motion.span>
            {!collapsed && <span className={active ? "font-medium" : ""}>{label}</span>}
            {active && <span aria-hidden className="ml-auto size-2 rounded-full bg-blue-500 shadow-[0_0_14px_rgba(0,114,245,0.8)]" />}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => setCatalogOpen((value) => !value)}
        aria-expanded={!collapsed && isCatalogExpanded}
        aria-controls="admin-catalog-submenu"
        aria-label="Toggle catalog menu"
        className={[
          "group flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
          catalogActive
            ? "border-blue-500/30 bg-blue-500/12 text-foreground"
            : "border-transparent text-foreground/80 hover:border-surface-border hover:bg-foreground/5",
        ].join(" ")}
      >
        <span className={catalogActive ? "text-blue-500" : "text-foreground/70 group-hover:text-blue-500"}>
          <FolderTree size={18} />
        </span>
        {!collapsed && (
          <>
            <span className={catalogActive ? "font-medium" : ""}>{t("catalog")}</span>
            <ChevronDown
              size={16}
              className={`ml-auto transition-transform duration-200 ${isCatalogExpanded ? "rotate-180" : ""}`}
            />
          </>
        )}
        {catalogActive && collapsed && (
          <span aria-hidden className="ml-auto size-2 rounded-full bg-blue-500 shadow-[0_0_14px_rgba(0,114,245,0.8)]" />
        )}
      </button>

      {!collapsed && (
        <AnimatePresence initial={false}>
          {isCatalogExpanded && (
            <motion.div
              id="admin-catalog-submenu"
              className="ml-3 overflow-hidden border-l border-surface-border/80 pl-3"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="space-y-1 py-1">
                {catalogItems.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const label = t(item.labelKey);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={[
                        "group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
                        active
                          ? "border-blue-500/30 bg-blue-500/12 text-foreground"
                          : "border-transparent text-foreground/75 hover:border-surface-border hover:bg-foreground/5",
                      ].join(" ")}
                    >
                      <span className={active ? "text-blue-500" : "text-foreground/65 group-hover:text-blue-500"}>
                        {item.icon}
                      </span>
                      <span className={active ? "font-medium" : ""}>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <button
        type="button"
        onClick={() => setCmsOpen((value) => !value)}
        aria-expanded={!collapsed && isCmsExpanded}
        aria-controls="admin-cms-submenu"
        aria-label="Toggle CMS menu"
        className={[
          "group flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
          cmsActive
            ? "border-blue-500/30 bg-blue-500/12 text-foreground"
            : "border-transparent text-foreground/80 hover:border-surface-border hover:bg-foreground/5",
        ].join(" ")}
      >
        <span className={cmsActive ? "text-blue-500" : "text-foreground/70 group-hover:text-blue-500"}>
          <FileText size={18} />
        </span>
        {!collapsed && (
          <>
            <span className={cmsActive ? "font-medium" : ""}>{t("pages_and_content")}</span>
            <ChevronDown
              size={16}
              className={`ml-auto transition-transform duration-200 ${isCmsExpanded ? "rotate-180" : ""}`}
            />
          </>
        )}
        {cmsActive && collapsed && (
          <span aria-hidden className="ml-auto size-2 rounded-full bg-blue-500 shadow-[0_0_14px_rgba(0,114,245,0.8)]" />
        )}
      </button>

      {!collapsed && (
        <AnimatePresence initial={false}>
          {isCmsExpanded && (
            <motion.div
              id="admin-cms-submenu"
              className="ml-3 overflow-hidden border-l border-surface-border/80 pl-3"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="space-y-1 py-1">
                {cmsItems.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const label = t(item.labelKey);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={[
                        "group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
                        active
                          ? "border-blue-500/30 bg-blue-500/12 text-foreground"
                          : "border-transparent text-foreground/75 hover:border-surface-border hover:bg-foreground/5",
                      ].join(" ")}
                    >
                      <span className={active ? "text-blue-500" : "text-foreground/65 group-hover:text-blue-500"}>
                        {item.icon}
                      </span>
                      <span className={active ? "font-medium" : ""}>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <button
        type="button"
        onClick={() => setMediaOpen((value) => !value)}
        aria-expanded={!collapsed && isMediaExpanded}
        aria-controls="admin-media-submenu"
        aria-label="Toggle media menu"
        className={[
          "group flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
          mediaActive
            ? "border-blue-500/30 bg-blue-500/12 text-foreground"
            : "border-transparent text-foreground/80 hover:border-surface-border hover:bg-foreground/5",
        ].join(" ")}
      >
        <span className={mediaActive ? "text-blue-500" : "text-foreground/70 group-hover:text-blue-500"}>
          <ImageIcon size={18} />
        </span>
        {!collapsed && (
          <>
            <span className={mediaActive ? "font-medium" : ""}>{t("media")}</span>
            <ChevronDown
              size={16}
              className={`ml-auto transition-transform duration-200 ${isMediaExpanded ? "rotate-180" : ""}`}
            />
          </>
        )}
        {mediaActive && collapsed && (
          <span aria-hidden className="ml-auto size-2 rounded-full bg-blue-500 shadow-[0_0_14px_rgba(0,114,245,0.8)]" />
        )}
      </button>

      {!collapsed && (
        <AnimatePresence initial={false}>
          {isMediaExpanded && (
            <motion.div
              id="admin-media-submenu"
              className="ml-3 overflow-hidden border-l border-surface-border/80 pl-3"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="space-y-1 py-1">
                {mediaItems.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const label = t(item.labelKey);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={[
                        "group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
                        active
                          ? "border-blue-500/30 bg-blue-500/12 text-foreground"
                          : "border-transparent text-foreground/75 hover:border-surface-border hover:bg-foreground/5",
                      ].join(" ")}
                    >
                      <span className={active ? "text-blue-500" : "text-foreground/65 group-hover:text-blue-500"}>
                        {item.icon}
                      </span>
                      <span className={active ? "font-medium" : ""}>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <button
        type="button"
        onClick={() => setSettingsOpen((value) => !value)}
        aria-expanded={!collapsed && isSettingsExpanded}
        aria-controls="admin-settings-submenu"
        aria-label="Toggle settings menu"
        className={[
          "group flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
          settingsActive
            ? "border-blue-500/30 bg-blue-500/12 text-foreground"
            : "border-transparent text-foreground/80 hover:border-surface-border hover:bg-foreground/5",
        ].join(" ")}
      >
        <span className={settingsActive ? "text-blue-500" : "text-foreground/70 group-hover:text-blue-500"}>
          <Store size={18} />
        </span>
        {!collapsed && (
          <>
            <span className={settingsActive ? "font-medium" : ""}>{t("shopping")}</span>
            <ChevronDown
              size={16}
              className={`ml-auto transition-transform duration-200 ${isSettingsExpanded ? "rotate-180" : ""}`}
            />
          </>
        )}
        {settingsActive && collapsed && (
          <span aria-hidden className="ml-auto size-2 rounded-full bg-blue-500 shadow-[0_0_14px_rgba(0,114,245,0.8)]" />
        )}
      </button>

      {!collapsed && (
        <AnimatePresence initial={false}>
          {isSettingsExpanded && (
            <motion.div
              id="admin-settings-submenu"
              className="ml-3 overflow-hidden border-l border-surface-border/80 pl-3"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="space-y-1 py-1">
                {settingsItems.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const label = t(item.labelKey);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      aria-label={label}
                      className={[
                        "group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
                        active
                          ? "border-blue-500/30 bg-blue-500/12 text-foreground"
                          : "border-transparent text-foreground/75 hover:border-surface-border hover:bg-foreground/5",
                        collapsed ? "justify-center px-2" : "",
                      ].join(" ")}
                    >
                      <span className={active ? "text-blue-500" : "text-foreground/65 group-hover:text-blue-500"}>
                        {item.icon}
                      </span>
                      {!collapsed && <span className={active ? "font-medium" : ""}>{label}</span>}
                      {collapsed && active && (
                        <span aria-hidden className="size-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(0,114,245,0.8)]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <button
        type="button"
        onClick={() => setEmailOpen((value) => !value)}
        aria-expanded={!collapsed && isEmailExpanded}
        aria-controls="admin-email-submenu"
        aria-label="Toggle email menu"
        className={[
          "group flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
          emailActive
            ? "border-blue-500/30 bg-blue-500/12 text-foreground"
            : "border-transparent text-foreground/80 hover:border-surface-border hover:bg-foreground/5",
        ].join(" ")}
      >
        <span className={emailActive ? "text-blue-500" : "text-foreground/70 group-hover:text-blue-500"}>
          <Mail size={18} />
        </span>
        {!collapsed && (
          <>
            <span className={emailActive ? "font-medium" : ""}>{t("email")}</span>
            <ChevronDown
              size={16}
              className={`ml-auto transition-transform duration-200 ${isEmailExpanded ? "rotate-180" : ""}`}
            />
          </>
        )}
        {emailActive && collapsed && (
          <span aria-hidden className="ml-auto size-2 rounded-full bg-blue-500 shadow-[0_0_14px_rgba(0,114,245,0.8)]" />
        )}
      </button>

      {!collapsed && (
        <AnimatePresence initial={false}>
          {isEmailExpanded && (
            <motion.div
              id="admin-email-submenu"
              className="ml-3 overflow-hidden border-l border-surface-border/80 pl-3"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="space-y-1 py-1">
                {emailItems.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const label = t(item.labelKey);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={[
                        "group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
                        active
                          ? "border-blue-500/30 bg-blue-500/12 text-foreground"
                          : "border-transparent text-foreground/75 hover:border-surface-border hover:bg-foreground/5",
                      ].join(" ")}
                    >
                      <span className={active ? "text-blue-500" : "text-foreground/65 group-hover:text-blue-500"}>
                        {item.icon}
                      </span>
                      <span className={active ? "font-medium" : ""}>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <button
        type="button"
        onClick={() => setCustomersOpen((value) => !value)}
        aria-expanded={!collapsed && isCustomersExpanded}
        aria-controls="admin-customers-submenu"
        aria-label="Toggle customers menu"
        className={[
          "group flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
          customersActive
            ? "border-blue-500/30 bg-blue-500/12 text-foreground"
            : "border-transparent text-foreground/80 hover:border-surface-border hover:bg-foreground/5",
        ].join(" ")}
      >
        <span className={customersActive ? "text-blue-500" : "text-foreground/70 group-hover:text-blue-500"}>
          <Users size={18} />
        </span>
        {!collapsed && (
          <>
            <span className={customersActive ? "font-medium" : ""}>{t("customers")}</span>
            <ChevronDown
              size={16}
              className={`ml-auto transition-transform duration-200 ${isCustomersExpanded ? "rotate-180" : ""}`}
            />
          </>
        )}
        {customersActive && collapsed && (
          <span aria-hidden className="ml-auto size-2 rounded-full bg-blue-500 shadow-[0_0_14px_rgba(0,114,245,0.8)]" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isCustomersExpanded && (
          <motion.div
            id="admin-customers-submenu"
            className={collapsed ? "space-y-1 pl-1" : "ml-3 overflow-hidden border-l border-surface-border/80 pl-3"}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="space-y-1 py-1">
              {customerItems.map((item) => {
                const active = isCustomersSubItemActive(pathname, item.href);
                const label = t(item.labelKey);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    aria-label={label}
                    className={[
                      "group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80",
                      active
                        ? "border-blue-500/30 bg-blue-500/12 text-foreground"
                        : "border-transparent text-foreground/75 hover:border-surface-border hover:bg-foreground/5",
                      collapsed ? "justify-center px-2" : "",
                    ].join(" ")}
                  >
                    <span className={active ? "text-blue-500" : "text-foreground/65 group-hover:text-blue-500"}>
                      {item.icon}
                    </span>
                    {!collapsed && <span className={active ? "font-medium" : ""}>{label}</span>}
                    {collapsed && active && (
                      <span aria-hidden className="size-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(0,114,245,0.8)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  onToggleCollapse,
  onCloseMobile,
}: {
  collapsed: boolean;
  pathname: string;
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
}) {
  const t = useTranslations("admin.menu");
  const collapseLabel = collapsed ? t("expand_sidebar") : t("collapse_sidebar");

  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80"
          onClick={onCloseMobile}
          aria-label={t("dashboard")}
        >
          <div className="flex size-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/14 text-sm font-semibold text-blue-600 dark:text-blue-300">
            G
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Go Ecommerce</p>
              <p className="truncate text-xs text-foreground/65">Admin</p>
            </div>
          )}
        </Link>
        {onCloseMobile ? (
          <Button
            isIconOnly
            variant="light"
            aria-label={t("close_menu")}
            onPress={onCloseMobile}
          >
            <X size={18} />
          </Button>
        ) : (
          <Button
            isIconOnly
            variant="light"
            aria-label={collapseLabel}
            onPress={onToggleCollapse}
          >
            <Menu size={18} />
          </Button>
        )}
      </div>

      <SidebarNav collapsed={collapsed} pathname={pathname} onNavigate={onCloseMobile} />
    </div>
  );
}

function AdminLocaleToggle() {
  const locale = useLocale();
  const router = useRouter();

  const toggleLocale = () => {
    const nextLocale = locale === "en" ? "lt" : "en";
    // We use router.replace to handle the URL prefix correctly
    // next-intl middleware will take care of the rest
    router.replace(window.location.pathname as any, { locale: nextLocale });
  };

  return (
    <Button
      isIconOnly
      variant="light"
      aria-label="Switch language"
      onClick={toggleLocale}
      className="flex flex-col items-center justify-center gap-0"
    >
      <Languages size={18} />
      <span className="text-[10px] font-bold leading-none uppercase">{locale}</span>
    </Button>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin.menu");
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  // Prevent hydration issues by only rendering the shell after mount
  if (!mounted) {
    return null;
  }

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const csrfToken = await getAdminCSRFToken();
      await logoutAdmin(csrfToken);
      window.location.href = "/admin/login";
    } catch {
      setLoggingOut(false);
    }
  }

  const sidebarTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 280, damping: 30, mass: 0.9 };

  const overlayTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.18 };

  return (
    <div className="hero-aurora min-h-screen bg-background text-foreground">
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/35 lg:hidden"
            onClick={() => setMobileOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            className="glass fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden"
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={sidebarTransition}
          >
            <SidebarContent
              collapsed={false}
              pathname={pathname}
              onCloseMobile={() => setMobileOpen(false)}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      <motion.aside
        className="glass fixed inset-y-4 left-4 z-30 hidden rounded-2xl lg:block"
        animate={{ width: collapsed ? DESKTOP_COLLAPSED_WIDTH : DESKTOP_EXPANDED_WIDTH }}
        transition={sidebarTransition}
      >
        <SidebarContent
          collapsed={collapsed}
          pathname={pathname}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </motion.aside>

      <main className={`px-4 pb-6 pt-4 lg:pb-8 ${collapsed ? "lg:ml-[120px]" : "lg:ml-[312px]"}`}>
        <div className="mx-auto max-w-7xl">
          <div className="glass mb-4 flex items-center gap-3 rounded-2xl px-3 py-3">
            <Button
              isIconOnly
              variant="light"
              className="lg:hidden"
              aria-label={t("open_menu")}
              onPress={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </Button>
            <Input
              id="admin-search-input"
              aria-label="Search"
              placeholder={t("search_placeholder")}
              startContent={<Search size={16} className="opacity-70" aria-hidden />}
              variant="bordered"
              classNames={{
                inputWrapper: "bg-transparent border-surface-border",
              }}
            />
            <Button
              as={Link}
              href="/"
              isIconOnly
              variant="light"
              aria-label={t("view_storefront")}
              title={t("view_storefront")}
            >
              <Store size={18} />
            </Button>
            <AdminLocaleToggle />
            <ThemeToggle />
            <Button variant="flat" size="sm" onPress={onLogout} isLoading={loggingOut}>
              {t("logout")}
            </Button>
          </div>
          <div>{children}</div>
        </div>
      </main>
    </div>
  );
}
