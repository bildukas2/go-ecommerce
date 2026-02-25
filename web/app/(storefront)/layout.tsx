import { cookies } from "next/headers";
import { CartButton, CartDrawer } from "@/components/cart-drawer";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentAccount } from "@/lib/api";
import { LogoutButton } from "@/components/account/logout-button";
import { AdminButton } from "@/components/admin-button";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}
