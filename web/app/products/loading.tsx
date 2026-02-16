export default function LoadingProducts() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
      <aside className="space-y-3 animate-pulse">
        <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
          ))}
        </div>
      </aside>
      <section>
        <div className="mb-6 h-6 w-40 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="aspect-square w-full rounded-md bg-neutral-200 dark:bg-neutral-800 mb-3" />
              <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded mb-2" />
              <div className="h-3 w-full bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
