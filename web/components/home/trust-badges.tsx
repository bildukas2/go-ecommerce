"use client";

import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/ui/glass-card";

export function TrustBadges() {
  const t = useTranslations("home.trust_badges");
  
  const badges = [
    { title: t("shipping_title"), description: t("shipping_desc") },
    { title: t("secure_title"), description: t("secure_desc") },
    { title: t("returns_title"), description: t("returns_desc") },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 md:py-12">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => (
          <GlassCard key={badge.title} className="p-5">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{badge.title}</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{badge.description}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
