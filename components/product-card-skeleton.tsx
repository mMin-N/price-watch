export function ProductCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-950 dark:ring-zinc-800"
      aria-hidden
    >
      <div className="aspect-[3/4] w-full animate-pulse bg-zinc-200 dark:bg-zinc-800" />
      <div className="space-y-2 p-2.5">
        <div className="h-3.5 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </div>
  );
}

export function ProductCardSkeletonList({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-2.5 sm:gap-3"
      aria-label="Loading products"
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
