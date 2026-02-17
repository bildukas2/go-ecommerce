import { AddToCartButton } from "@/components/add-to-cart";
import { GlassCard } from "@/components/ui/glass-card";
import { getProduct } from "@/lib/api";
import Image from "next/image";

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
    }).format((cents || 0) / 100);
  } catch {
    return `${(cents || 0) / 100} ${currency || ""}`.trim();
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  const primaryImage = product.images?.[0];
  const firstAvailableVariant = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];

  return (
    <div className="hero-aurora mx-auto max-w-5xl px-6 py-10">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <GlassCard className="p-3">
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt || product.title}
              width={800}
              height={800}
              className="aspect-square w-full rounded-xl bg-neutral-100 object-cover dark:bg-neutral-900"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              No image available
            </div>
          )}
        </GlassCard>

        <GlassCard className="space-y-6 p-6">
          <div className="space-y-2">
            <h1 className="mb-2 text-2xl font-semibold">{product.title}</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{product.description}</p>
          </div>

          <div className="rounded-xl border border-surface-border bg-background/30 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Price</h2>
            {firstAvailableVariant ? (
              <p className="mt-1 text-xl font-semibold">
                {formatMoney(firstAvailableVariant.priceCents, firstAvailableVariant.currency)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">No active price</p>
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
