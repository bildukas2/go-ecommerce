import { getProduct } from "@/lib/api";
import { AddToCartButton } from "@/components/add-to-cart";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <div className="aspect-square w-full rounded-lg bg-neutral-100 dark:bg-neutral-900" />
        </div>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold mb-2">{product.title}</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{product.description}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Variants</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Variant selection and pricing will appear here once exposed by the API.</p>
          </div>

          <div className="pt-2">
            <AddToCartButton />
            <p className="mt-2 text-xs text-neutral-500">This ensures your cart is created; item adding is part of the next step.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
