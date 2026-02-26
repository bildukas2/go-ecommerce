import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { FavoriteRemoveButton } from "@/components/account/favorite-remove-button";
import { getAccountFavorites } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

type FavoritesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountFavoritesPage({ searchParams }: FavoritesPageProps) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsed = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const limit = 12;
  const cookieHeader = (await cookies()).toString();
  let response: Awaited<ReturnType<typeof getAccountFavorites>>;

  try {
    response = await getAccountFavorites({ page, limit }, { cookieHeader });
  } catch {
    redirect("/account/login?next=/account/favorites");
  }

  const hasPrev = response.page > 1;
  const hasNext = response.page * response.limit < response.total;

  return (
    <AccountShell title="Favorites" subtitle="Products you saved for later." active="favorites">
      {response.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface p-6 text-sm text-neutral-600 dark:text-neutral-400">
          No favorites yet. Save products from their detail pages.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {response.items.map((item) => (
            <article key={item.product_id} className="rounded-2xl border border-surface-border bg-surface p-4">
              <Link href={`/products/${encodeURIComponent(item.slug)}`} className="block">
                <div className="image-default-bg overflow-hidden rounded-xl border border-surface-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.default_image_url || "/images/noImage.png"}
                    alt={item.title}
                    className="h-44 w-full object-cover"
                  />
                </div>
                <h2 className="mt-3 font-semibold">{item.title}</h2>
              </Link>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {item.price_cents !== null && item.currency
                  ? formatMoney(item.price_cents, item.currency)
                  : "Price unavailable"}
              </p>
              <div className="mt-3">
                <FavoriteRemoveButton productID={item.product_id} />
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface p-4 text-sm">
        <Link href={hasPrev ? `/account/favorites?page=${response.page - 1}` : "#"} className={hasPrev ? "underline" : "pointer-events-none text-neutral-400"}>
          Previous
        </Link>
        <span>
          Page {response.page}
        </span>
        <Link href={hasNext ? `/account/favorites?page=${response.page + 1}` : "#"} className={hasNext ? "underline" : "pointer-events-none text-neutral-400"}>
          Next
        </Link>
      </div>
    </AccountShell>
  );
}
