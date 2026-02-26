export default function LoadingProducts() {
  return (
    <div className="hero-aurora mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 md:grid-cols-[240px_1fr]">
      <aside className="space-y-4">
        <div className="glass rounded-2xl p-4">
          <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            ))}
          </div>
        </div>
      </aside>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-36 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="h-8 w-28 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-3">
              <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
              <div className="mt-3 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-3 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-4 w-24 flex-1 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-8 w-8 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
