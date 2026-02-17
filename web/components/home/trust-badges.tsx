import { GlassCard } from "@/components/ui/glass-card";

const badges = [
  { title: "Fast Shipping", description: "Most orders leave the warehouse within 24 hours." },
  { title: "Secure Checkout", description: "Encrypted payment flow with trusted providers." },
  { title: "Easy Returns", description: "Hassle-free returns for eligible orders." },
];

export function TrustBadges() {
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
