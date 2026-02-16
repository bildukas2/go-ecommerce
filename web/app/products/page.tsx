import Link from "next/link";
import { getCategories, getProducts } from "@/lib/api";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ page?: string; category?: string }> }) {
  const params = await searchParams;
  const page = Number(params.page ?? 1) || 1;
  const category = params.category ?? "";

  const [{ items, total, page: currentPage, limit }, cats] = await Promise.all([
    getProducts({ page, limit: 12, category: category || undefined }),
    getCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
      <aside className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Categories</h2>
        <ul className="space-y-2">
          <li>
            <Link href="/products" className={`block text-sm ${!category ? "font-semibold text-black dark:text-white" : "text-neutral-600 dark:text-neutral-300"}`}>
              All
            </Link>
          </li>
          {cats.items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/products?category=${encodeURIComponent(c.slug)}`}
                className={`block text-sm ${category === c.slug ? "font-semibold text-black dark:text-white" : "text-neutral-600 dark:text-neutral-300"}`}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Products</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{total} items</p>
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Page {currentPage} of {totalPages}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((p) => (
            <Link key={p.id} href={`/products/${encodeURIComponent(p.slug)}`} className="group rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 hover:shadow-sm transition-shadow">
              <div className="aspect-square w-full rounded-md bg-neutral-100 dark:bg-neutral-900 mb-3 group-hover:opacity-95 transition" />
              <div className="space-y-1">
                <h3 className="text-sm font-medium leading-tight line-clamp-2">{p.title}</h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">{p.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <PaginationLink href={`/products?${new URLSearchParams({ ...(category ? { category } : {}), page: String(Math.max(1, currentPage - 1)) }).toString()}`} disabled={currentPage <= 1}>
            Previous
          </PaginationLink>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">{currentPage} / {totalPages}</span>
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
      <span className="px-3 py-2 text-sm rounded-md bg-neutral-100 dark:bg-neutral-900 text-neutral-400 cursor-not-allowed">{children}</span>
    );
  }
  return (
    <Link href={href} className="px-3 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition">
      {children}
    </Link>
  );
}
