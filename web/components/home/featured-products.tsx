import Link from "next/link";
import type { Product } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

type FeaturedProductsProps = {
  products: Product[];
};

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-8 md:py-10">
      <div className="mb-5 flex items-end justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Featured products</h2>
        <Button asChild variant="outline">
          <Link href="/products">Browse catalog</Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <GlassCard className="rounded-2xl border-dashed p-8 text-center text-neutral-600 dark:text-neutral-300">
          No featured products available yet.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Link key={product.id} href={`/products/${encodeURIComponent(product.slug)}`} className="group">
              <GlassCard className="h-full p-4">
                <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-neutral-100 via-white to-neutral-100 transition-opacity group-hover:opacity-90 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900" />
                <h3 className="mt-4 line-clamp-2 text-base font-medium text-neutral-900 dark:text-neutral-100">{product.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{product.description}</p>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
