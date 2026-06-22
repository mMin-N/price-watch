"use client";

import Link from "next/link";
import type { Product } from "@/lib/types/product";
import {
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

export function ProductCard({ product, onDelete, deleting }: ProductCardProps) {
  const displayTitle = product.title?.trim() || "Untitled product";
  const priceChange = formatPriceChange(
    product.priceChange,
    product.priceChangePercent,
    product.currency
  );

  return (
    <article className="group overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-950 dark:ring-zinc-800">
      <a
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block overflow-hidden bg-zinc-100 dark:bg-zinc-900"
        aria-label={`Open ${displayTitle} in store`}
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={displayTitle}
            className="block w-full h-auto"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800">
            <span className="text-3xl font-semibold text-zinc-400 dark:text-zinc-600">
              {product.siteName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {product.alertActive ? (
          <span className="absolute left-2 top-2 rounded-md bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Alert
          </span>
        ) : null}

        {product.autoRefreshPaused ? (
          <span className="absolute right-2 top-2 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Paused
          </span>
        ) : null}
      </a>

      <div className="p-2.5">
        <Link href={`/products/${product.id}`} className="block min-w-0">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-50">
            {displayTitle}
          </h3>

          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <p className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatPrice(product.lastPrice, product.currency)}
            </p>
            {priceChange ? (
              <span
                className={
                  priceChange.direction === "down"
                    ? "shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    : priceChange.direction === "up"
                      ? "shrink-0 text-xs font-semibold text-red-600 dark:text-red-400"
                      : "shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400"
                }
              >
                {priceChange.text}
              </span>
            ) : null}
          </div>

          {(product.lastFetchedAt) && (
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {product.lastFetchedAt ? (
                <span>{formatRelativeTime(product.lastFetchedAt)}</span>
              ) : null}
            </div>
          )}
        </Link>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-900">
          <Link
            href={`/products/${product.id}`}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Details
          </Link>
          <button
            type="button"
            onClick={() => onDelete(product.id, product.title, product.url)}
            disabled={deleting}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
          >
            {deleting ? "..." : "Remove"}
          </button>
        </div>
      </div>
    </article>
  );
}
