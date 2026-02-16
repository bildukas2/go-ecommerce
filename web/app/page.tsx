import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white dark:from-black dark:to-neutral-950">
      <section className="mx-auto max-w-6xl px-6 pt-28 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
              Fast, Minimal Storefront
            </h1>
            <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
              Browse products, add to cart, and check out. Built with Next.js App Router and a Go API.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Button asChild>
                <Link href="/products">Browse Products</Link>
              </Button>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                API: {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-3xl bg-neutral-100 dark:bg-neutral-900" />
          </div>
        </div>
      </section>
    </main>
  );
}
