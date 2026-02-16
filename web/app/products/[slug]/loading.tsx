export default function LoadingProductDetail() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="aspect-square w-full rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
        <div className="space-y-4">
          <div className="h-7 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-10 w-40 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mt-4" />
        </div>
      </div>
    </div>
  );
}
