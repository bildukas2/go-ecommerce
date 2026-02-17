import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Flame } from "lucide-react";

export function HomeHero() {
  return (
    <section className="hero-aurora mx-auto max-w-6xl px-6 pb-12 pt-14 md:pb-16 md:pt-20">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
        <div>
          <span className="hero-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <Flame size={11} className="hero-badge-flame" aria-hidden="true" />
            Built for fast, modern commerce
            <ArrowUpRight size={10} className="hero-badge-arrow opacity-70" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Style your home with pieces that ship fast.
          </h1>
          <p className="mt-4 max-w-xl text-base text-neutral-600 md:text-lg dark:text-neutral-300">
            Discover curated essentials, bestselling favorites, and new arrivals in one seamless storefront.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              className="rounded-full border-0 bg-[#0072f5] px-5 text-white hover:bg-[#0065db] dark:bg-[#0072f5] dark:text-white dark:hover:bg-[#0b7bff]"
            >
              <Link href="/products">Shop featured products</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border border-neutral-300 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 dark:border-[#2e3038] dark:bg-[#16181f] dark:text-neutral-200 dark:hover:bg-[#1d2028]"
            >
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
