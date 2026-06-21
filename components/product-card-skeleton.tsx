export function ProductCardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      aria-hidden
    >
      <div className="flex items-start justify-between gap-3">
        <div className="h-5 flex-1 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-7 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="mt-3 h-4 w-2/3 rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-3 flex justify-between">
        <div className="h-3 w-16 rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-3 w-12 rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </div>
  );
}

export function ProductCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading products">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
