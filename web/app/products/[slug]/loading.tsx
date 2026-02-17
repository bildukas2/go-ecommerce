export default function LoadingProductDetail() {
  return (
    <div className="hero-aurora mx-auto max-w-6xl px-6 py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="glass space-y-3 rounded-2xl p-3">
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square w-full animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
            ))}
          </div>
        </div>

        <div className="glass space-y-6 rounded-2xl p-6">
          <div className="flex gap-2">
            <div className="h-6 w-24 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="space-y-2">
            <div className="h-9 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>

          <div className="rounded-2xl border border-surface-border bg-background/40 p-4">
            <div className="h-3 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="mt-2 h-8 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>

          <div className="space-y-3">
            <div className="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-10 w-36 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
            <div className="glass rounded-2xl p-4">
              <div className="h-5 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="mt-2 h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="mt-3 h-9 w-40 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
