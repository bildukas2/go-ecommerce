import { AddToCartButton } from "@/components/add-to-cart";
import { ProductImageGallery } from "@/components/storefront/product-image-gallery";
import { GlassCard } from "@/components/ui/glass-card";
import { getProduct } from "@/lib/api";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  const inStockCount = product.variants.filter((variant) => variant.stock > 0).length;

  return (
    <div className="hero-aurora mx-auto max-w-6xl px-6 py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
        <GlassCard className="space-y-3 p-3">
          <ProductImageGallery images={product.images} productTitle={product.title} />
        </GlassCard>

        <GlassCard className="space-y-6 p-6 lg:sticky lg:top-24 lg:h-fit">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="glass rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                {inStockCount > 0 ? `${inStockCount} in stock` : "Currently unavailable"}
              </span>
              <span className="rounded-full border border-surface-border bg-surface/70 px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                {product.variants.length} variants
              </span>
            </div>
            <h1 className="mb-1 text-3xl font-semibold leading-tight">{product.title}</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{product.description}</p>
          </div>

          <div className="pt-2">
            <AddToCartButton variants={product.variants} />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
