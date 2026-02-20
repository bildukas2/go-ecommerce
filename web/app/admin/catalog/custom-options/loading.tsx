export default function AdminCustomOptionsLoading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-9 w-64 animate-pulse rounded-lg bg-foreground/10" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-foreground/10" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-xl bg-foreground/10" />
      </div>

      <div className="glass rounded-2xl border border-surface-border/80 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
          <div className="h-14 animate-pulse rounded-xl bg-foreground/10" />
          <div className="h-14 animate-pulse rounded-xl bg-foreground/10" />
          <div className="h-10 animate-pulse rounded-xl bg-foreground/10 md:self-end" />
        </div>
      </div>

      <div className="glass overflow-x-auto rounded-2xl border border-surface-border/80">
        <div className="min-w-[980px] p-4">
          <div className="grid grid-cols-[2fr_2fr_1fr_2fr_1fr_2fr] gap-3 border-b border-surface-border/70 pb-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`header-${i}`} className="h-4 animate-pulse rounded bg-foreground/10" />
            ))}
          </div>
          <div className="space-y-3 pt-4">
            {Array.from({ length: 6 }).map((_, row) => (
              <div key={`row-${row}`} className="grid grid-cols-[2fr_2fr_1fr_2fr_1fr_2fr] gap-3">
                {Array.from({ length: 6 }).map((__, cell) => (
                  <div key={`cell-${row}-${cell}`} className="h-8 animate-pulse rounded-lg bg-foreground/10" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
