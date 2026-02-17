import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CartButton, CartDrawer } from "@/components/cart-drawer";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Go Ecommerce",
  description: "Demo storefront",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <Providers>
          <header className="relative z-40 border-b border-neutral-200 dark:border-neutral-800">
            <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
              <Link href="/" className="text-sm font-semibold">go-ecommerce</Link>
              <nav className="flex items-center gap-3">
                <Link href="/products" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Products</Link>
                <ThemeToggle />
                <CartButton />
              </nav>
            </div>
          </header>
          {children}
          <CartDrawer />
        </Providers>
      </body>
    </html>
  );
}
