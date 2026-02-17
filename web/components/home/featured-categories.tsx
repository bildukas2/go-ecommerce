import Link from "next/link";
import type { Category } from "@/lib/api";
import { GlassCard } from "@/components/ui/glass-card";

type FeaturedCategoriesProps = {
  categories: Category[];
};

export function FeaturedCategories({ categories }: FeaturedCategoriesProps) {
  const featured = categories.slice(0, 6);
  if (featured.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-8 md:py-10">
      <div className="mb-5 flex items-end justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Featured categories</h2>
        <Link href="/products" className="text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-400">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((category) => (
          <Link key={category.id} href={`/products?category=${encodeURIComponent(category.slug)}`} className="group">
            <GlassCard className="p-5 transition-colors hover:bg-white/80 dark:hover:bg-slate-900/50">
              <div className="mb-4 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                <img
                  src={category.defaultImageUrl || "/images/noImage.png"}
                  alt={category.name}
                  className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Category</p>
              <h3 className="mt-2 text-lg font-medium text-neutral-900 dark:text-neutral-100">{category.name}</h3>
              <p className="mt-3 text-sm text-neutral-600 transition-transform group-hover:translate-x-1 dark:text-neutral-400">
                Explore products -&gt;
              </p>
            </GlassCard>
          </Link>
        ))}
      </div>
    </section>
  );
}
