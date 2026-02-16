import Link from "next/link";
import type { Product } from "@/lib/api";
import { Button } from "@/components/ui/button";

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
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          No featured products available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${encodeURIComponent(product.slug)}`}
              className="group rounded-2xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="aspect-[4/3] rounded-xl bg-neutral-100 transition-opacity group-hover:opacity-90 dark:bg-neutral-900" />
              <h3 className="mt-4 line-clamp-2 text-base font-medium text-neutral-900 dark:text-neutral-100">{product.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{product.description}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
