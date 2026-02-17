import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HomeHero() {
  return (
    <section className="hero-aurora mx-auto max-w-6xl px-6 pb-12 pt-14 md:pb-16 md:pt-20">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
        <div>
          <span className="glass inline-flex rounded-full px-3 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Built for fast, modern commerce
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Style your home with pieces that ship fast.
          </h1>
          <p className="mt-4 max-w-xl text-base text-neutral-600 md:text-lg dark:text-neutral-300">
            Discover curated essentials, bestselling favorites, and new arrivals in one seamless storefront.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/products">Shop featured products</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/products">Browse all products</Link>
            </Button>
          </div>
        </div>

        <div className="glass relative overflow-hidden rounded-3xl p-6">
          <div className="absolute -right-24 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--glow-secondary)_0%,transparent_65%)] opacity-80 dark:opacity-100" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,var(--glow-primary)_0%,transparent_70%)] opacity-70 dark:opacity-90" />
          <div className="relative aspect-[16/9] rounded-2xl border border-surface-border bg-white/86 p-6 ring-1 ring-black/5 dark:bg-neutral-900/92 dark:ring-white/10">
            <div className="flex h-full flex-col justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Today&apos;s spotlight</p>
                <h2 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Weekend Living Room Refresh</h2>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                Mix cozy textures with clean silhouettes for a modern, warm setup.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
