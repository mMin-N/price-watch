"use client";

import Link from "next/link";
import type { Product } from "@/lib/types/product";
import {
  formatDistanceToTarget,
  formatPriceChange,
  formatRelativeTime,
} from "@/lib/format/display";

type ProductCardProps = {
  product: Product;
  onDelete: (id: string, title: string | null, url: string) => void;
  deleting: boolean;
};

function formatPrice(price: number | null, currency: string) {
  if (price === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(price);
}

function siteBadgeLabel(product: Product): string {
  if (product.site === "generic") {
    return "Unsupported site";
  }
  return product.siteName;
}

export function ProductCard({ product, onDelete, deleting }: ProductCardProps) {
  const displayTitle = product.title?.trim() || "Untitled product";
  const priceChange = formatPriceChange(
    product.priceChange,
    product.priceChangePercent,
    product.currency
  );
  const distance = formatDistanceToTarget(
    product.distanceToTarget,
    product.currency
  );

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      {product.autoRefreshPaused && (
        <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          Updates paused
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <Link href={`/products/${product.id}`} className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {displayTitle}
          </h3>
        </Link>
        <p className="shrink-0 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
          {formatPrice(product.lastPrice, product.currency)}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          {priceChange ? (
            <span
              className={
                priceChange.direction === "down"
                  ? "font-medium text-emerald-700 dark:text-emerald-400"
                  : priceChange.direction === "up"
                    ? "font-medium text-red-600 dark:text-red-400"
                    : "font-medium text-zinc-600 dark:text-zinc-400"
              }
            >
              {priceChange.text}
            </span>
          ) : null}
          {distance ? (
            <span
              className={
                distance.met
                  ? "font-medium text-emerald-700 dark:text-emerald-400"
                  : "text-zinc-600 dark:text-zinc-400"
              }
            >
              {distance.text}
            </span>
          ) : null}
        </div>
        {product.alertActive ? (
          <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Alert
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="truncate opacity-70">{siteBadgeLabel(product)}</span>
        <span className="shrink-0">{formatRelativeTime(product.lastFetchedAt)}</span>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
        <Link
          href={`/products/${product.id}`}
          className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          View
        </Link>
        <button
          type="button"
          onClick={() => onDelete(product.id, product.title, product.url)}
          disabled={deleting}
          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </article>
  );
}
