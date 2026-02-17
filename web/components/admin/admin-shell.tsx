"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button, Input } from "@heroui/react";
import { LayoutDashboard, Menu, Search, ShoppingCart, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const DESKTOP_EXPANDED_WIDTH = 280;
const DESKTOP_COLLAPSED_WIDTH = 88;

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/admin/orders", label: "Orders", icon: <ShoppingCart size={18} /> },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
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
  return (
    <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Admin navigation">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-label={item.label}
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
            {!collapsed && <span className={active ? "font-medium" : ""}>{item.label}</span>}
            {active && <span aria-hidden className="ml-auto size-2 rounded-full bg-blue-500 shadow-[0_0_14px_rgba(0,114,245,0.8)]" />}
          </Link>
        );
      })}
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
  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80"
          onClick={onCloseMobile}
          aria-label="Go to admin dashboard"
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
            aria-label="Close admin menu"
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

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
              aria-label="Open admin menu"
              onPress={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </Button>
            <Input
              aria-label="Search"
              placeholder="Search admin..."
              startContent={<Search size={16} className="opacity-70" aria-hidden />}
              variant="bordered"
              classNames={{
                inputWrapper: "bg-transparent border-surface-border",
              }}
            />
            <ThemeToggle />
          </div>
          <div>{children}</div>
        </div>
      </main>
    </div>
  );
}
