import { AddToCartButton } from "@/components/add-to-cart";
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
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt || product.title}
              width={800}
              height={800}
              className="aspect-square w-full rounded-lg object-cover bg-neutral-100 dark:bg-neutral-900"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-neutral-100 text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              No image available
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="mb-2 text-2xl font-semibold">{product.title}</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{product.description}</p>
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Price</h2>
            {firstAvailableVariant ? (
              <p className="text-xl font-semibold">
                {formatMoney(firstAvailableVariant.priceCents, firstAvailableVariant.currency)}
              </p>
            ) : (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">No active price</p>
            )}
          </div>

          <div className="pt-2">
            <AddToCartButton variants={product.variants} />
          </div>
        </div>
      </div>
    </div>
  );
}
