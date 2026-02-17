import Link from "next/link";
import { getCategories } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  let categories: Awaited<ReturnType<typeof getCategories>>["items"] = [];
  let fetchError: string | null = null;

  try {
    const response = await getCategories();
    categories = response.items;
  } catch {
    fetchError = "Failed to load categories. Please retry.";
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-foreground/70">Manage how products are grouped in your catalog.</p>
        </div>
        <Link
          href="/admin/catalog/products"
          className="rounded-xl border border-surface-border bg-foreground/[0.02] px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
        >
          Browse products
        </Link>
      </div>

      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {!fetchError && categories.length === 0 && (
        <div className="glass rounded-2xl border p-10 text-center">
          <h2 className="text-lg font-semibold">No categories yet</h2>
          <p className="mt-2 text-sm text-foreground/65">Create categories in the API seed/migrations to organize products.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <article
            key={category.id}
            className="glass glass-lift overflow-hidden rounded-2xl border shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]"
          >
            <div className="image-default-bg relative h-36 border-b border-surface-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={category.defaultImageUrl || "/images/noImage.png"}
                alt={category.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="line-clamp-2 text-lg font-semibold">{category.name}</h2>
                <span
                  className={[
                    "rounded-full px-2 py-1 text-xs font-medium",
                    category.parentId
                      ? "bg-blue-500/12 text-blue-700 dark:text-blue-300"
                      : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
                  ].join(" ")}
                >
                  {category.parentId ? "Child" : "Root"}
                </span>
              </div>
              <p className="font-mono text-xs text-foreground/60">/{category.slug}</p>
              <Link
                href={`/admin/catalog/products?category=${encodeURIComponent(category.slug)}`}
                className="inline-flex rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/[0.05]"
              >
                View products
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
