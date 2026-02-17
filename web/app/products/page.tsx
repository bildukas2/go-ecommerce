import Link from "next/link";
import { getCategories, getProducts } from "@/lib/api";
import { GlassCard } from "@/components/ui/glass-card";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const rawCategory = Array.isArray(params.category) ? params.category[0] : params.category;
  const category = typeof rawCategory === "string" ? rawCategory : "";

  const [{ items, total, page: currentPage, limit }, cats] = await Promise.all([
    getProducts({ page, limit: 12, category: category || undefined }),
    getCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="hero-aurora mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 md:grid-cols-[240px_1fr]">
      <aside className="space-y-4">
        <GlassCard className="p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Categories</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link
                href="/products"
                className={`block rounded-lg px-2 py-1 text-sm transition-colors ${!category ? "bg-primary/10 font-semibold text-foreground" : "text-neutral-600 hover:text-foreground dark:text-neutral-300"}`}
              >
                All
              </Link>
            </li>
            {cats.items.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/products?category=${encodeURIComponent(c.slug)}`}
                  className={`block rounded-lg px-2 py-1 text-sm transition-colors ${category === c.slug ? "bg-primary/10 font-semibold text-foreground" : "text-neutral-600 hover:text-foreground dark:text-neutral-300"}`}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      </aside>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Products</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{total} items</p>
          </div>
          <div className="rounded-full border border-surface-border bg-surface px-3 py-1 text-sm text-neutral-600 dark:text-neutral-300">
            Page {currentPage} of {totalPages}
          </div>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <Link key={p.id} href={`/products/${encodeURIComponent(p.slug)}`} className="group">
                <GlassCard className="h-full p-4">
                  <div className="mb-3 aspect-square w-full rounded-xl bg-gradient-to-br from-neutral-100 to-white transition-opacity group-hover:opacity-95 dark:from-neutral-900 dark:to-neutral-950" />
                  <div className="space-y-1">
                    <h3 className="line-clamp-2 text-sm font-medium leading-tight">{p.title}</h3>
                    <p className="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">{p.description}</p>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        ) : (
          <GlassCard className="rounded-lg border-dashed p-8 text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">No products found for this filter.</p>
          </GlassCard>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <PaginationLink href={`/products?${new URLSearchParams({ ...(category ? { category } : {}), page: String(Math.max(1, currentPage - 1)) }).toString()}`} disabled={currentPage <= 1}>
            Previous
          </PaginationLink>
          <span className="text-sm text-neutral-600 dark:text-neutral-300">{currentPage} / {totalPages}</span>
          <PaginationLink href={`/products?${new URLSearchParams({ ...(category ? { category } : {}), page: String(Math.min(totalPages, currentPage + 1)) }).toString()}`} disabled={currentPage >= totalPages}>
            Next
          </PaginationLink>
        </div>
      </section>
    </div>
  );
}

function PaginationLink({ href, disabled, children }: { href: string; disabled?: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span className="rounded-full border border-surface-border bg-surface px-4 py-2 text-sm text-neutral-400 cursor-not-allowed">{children}</span>
    );
  }
  return (
    <Link href={href} className="rounded-full border border-surface-border bg-surface px-4 py-2 text-sm transition hover:bg-white/80 dark:hover:bg-neutral-900/80">
      {children}
    </Link>
  );
}
