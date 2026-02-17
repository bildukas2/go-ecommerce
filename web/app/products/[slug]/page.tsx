import { AddToCartButton } from "@/components/add-to-cart";
import { GlassCard } from "@/components/ui/glass-card";
import { getProduct } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import Image from "next/image";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  const primaryImage = product.images?.[0];
  const firstAvailableVariant = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
  const inStockCount = product.variants.filter((variant) => variant.stock > 0).length;
  const variantPrices = product.variants.map((variant) => variant.priceCents);
  const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : null;
  const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : null;
  const selectedAttributes = firstAvailableVariant ? Object.entries(firstAvailableVariant.attributes) : [];

  return (
    <div className="hero-aurora mx-auto max-w-6xl px-6 py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
        <GlassCard className="space-y-3 p-3">
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt || product.title}
              width={800}
              height={800}
              className="aspect-square w-full rounded-2xl border border-white/10 bg-neutral-100 object-cover dark:bg-neutral-900"
            />
          ) : (
            <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-neutral-100 text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <div className="absolute -inset-10 bg-[radial-gradient(circle_at_20%_20%,rgba(0,114,245,.15),transparent_55%)]" />
              <span className="relative">No image available</span>
            </div>
          )}

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(0, 4).map((image) => (
                <div key={image.id} className="overflow-hidden rounded-xl border border-white/10 bg-background/40">
                  <Image
                    src={image.url}
                    alt={image.alt || product.title}
                    width={240}
                    height={240}
                    className="aspect-square w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
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

          <div className="rounded-2xl border border-surface-border bg-background/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Price</h2>
            {firstAvailableVariant ? (
              <>
                <p className="mt-1 text-3xl font-semibold">
                  {formatMoney(firstAvailableVariant.priceCents, firstAvailableVariant.currency)}
                </p>
                {minPrice !== null && maxPrice !== null && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Range: {formatMoney(minPrice, firstAvailableVariant.currency)}
                    {" - "}
                    {formatMoney(maxPrice, firstAvailableVariant.currency)}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">No active price</p>
            )}
          </div>

          <div className="rounded-2xl border border-surface-border bg-background/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Variant details</h2>
            {firstAvailableVariant ? (
              <div className="mt-2 space-y-2 text-sm">
                <p>
                  <span className="text-neutral-500">SKU:</span> {firstAvailableVariant.sku || "N/A"}
                </p>
                <p>
                  <span className="text-neutral-500">Stock:</span> {Math.max(0, firstAvailableVariant.stock)}
                </p>
                <p>
                  <span className="text-neutral-500">Attributes:</span>{" "}
                  {selectedAttributes.length > 0
                    ? selectedAttributes.map(([key, value]) => `${key}: ${String(value)}`).join(" / ")
                    : "N/A"}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">No variant metadata</p>
            )}
          </div>

          <div className="pt-2">
            <AddToCartButton variants={product.variants} />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
