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
  let isAuthenticated = false;
  try {
    const cookieHeader = (await cookies()).toString();
    await getCurrentAccount({ cookieHeader });
    isAuthenticated = true;
  } catch {}

  return (
    <>
      <header className="relative z-40 border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold">go-ecommerce</Link>
          <nav className="flex items-center gap-3">
            <Link href="/products" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Products</Link>
            {isAuthenticated ? (
              <>
                <Link href="/account" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Account</Link>
                <AdminButton />
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
      {children}
      <CartDrawer />
    </>
  );
}
