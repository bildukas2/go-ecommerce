"use client";

export default function ProductsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20 text-center">
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">{error.message}</p>
      <button onClick={() => reset()} className="px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900">
        Try again
      </button>
    </div>
  );
}
