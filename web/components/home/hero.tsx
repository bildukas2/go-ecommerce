"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Flame } from "lucide-react";

export function HomeHero() {
  const t = useTranslations("home.hero");
  return (
    <section className="hero-aurora mx-auto max-w-6xl px-6 pb-12 pt-14 md:pb-16 md:pt-20">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
        <div>
          <span className="hero-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <Flame size={11} className="hero-badge-flame" aria-hidden="true" />
            {t("badge")}
            <ArrowUpRight size={10} className="hero-badge-arrow opacity-70" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-xl text-base text-neutral-600 md:text-lg dark:text-neutral-300">
            {t("description")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              className="rounded-full border-0 bg-[#0072f5] px-5 text-white hover:bg-[#0065db] dark:bg-[#0072f5] dark:text-white dark:hover:bg-[#0b7bff]"
            >
              <Link href="/products">{t("shop_featured")}</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border border-neutral-300 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 dark:border-[#2e3038] dark:bg-[#16181f] dark:text-neutral-200 dark:hover:bg-[#1d2028]"
            >
              <Link href="/products">{t("browse_all")}</Link>
            </Button>
          </div>
        </div>

        <div className="glass relative overflow-hidden rounded-3xl p-6">
          <div className="absolute -right-24 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--glow-secondary)_0%,transparent_65%)] opacity-80 dark:opacity-100" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,var(--glow-primary)_0%,transparent_70%)] opacity-70 dark:opacity-90" />
          <div className="relative aspect-[16/9] rounded-2xl border border-surface-border bg-white/86 p-6 ring-1 ring-black/5 dark:bg-neutral-900/92 dark:ring-white/10">
            <div className="flex h-full items-center justify-center">
              <Image src="/img/Volm logo small.png" alt="Volm" width={300} height={300} className="object-contain" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
