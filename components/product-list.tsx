"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product, Wishlist } from "@/lib/types/product";

type ProductListProps = {
  products: Product[];
  onRefresh: () => void;
};

function formatPrice(price: number | null, currency: string) {
  if (price === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(price);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function siteBadgeLabel(product: Product): string {
  if (product.site === "generic") {
    return "Unsupported site";
  }
  return product.siteName;
}

export function ProductList({ products, onRefresh }: ProductListProps) {
  const [wishlistNames, setWishlistNames] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWishlists() {
      try {
        const res = await fetch("/api/wishlists");
        if (!res.ok) return;
        const data = (await res.json()) as { wishlists?: Wishlist[] };
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const wishlist of data.wishlists ?? []) {
          map[wishlist.id] = wishlist.name;
        }
        setWishlistNames(map);
      } catch {
        // ignore fetch errors for display names
      }
    }

    fetchWishlists();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(id: string, title: string | null, url: string) {
    const label = title ?? url;
    if (!window.confirm(`Stop tracking "${label}"?`)) return;

    setDeletingId(id);
    setActionError(null);

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to delete product");
        return;
      }

      onRefresh();
    } catch {
      setActionError("Failed to delete product");
    } finally {
      setDeletingId(null);
    }
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No tracked products yet. Add a product URL above to start monitoring prices.
      </p>
    );
  }

  return (
    <section>
      {actionError && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {actionError}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Product
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Site
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Last price
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Alerts
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Last updated
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Wishlist
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              return (
                <tr
                  key={product.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    <div className="font-medium">{product.title ?? "Untitled"}</div>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block max-w-xs truncate text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                    >
                      {product.url}
                    </a>
                    {product.autoRefreshPaused && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        Auto-refresh paused after repeated failures
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {siteBadgeLabel(product)}
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    {formatPrice(product.lastPrice, product.currency)}
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    <div>
                      {product.targetPrice !== null
                        ? `≤ ${formatPrice(product.targetPrice, product.currency)}`
                        : "—"}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {product.discountAlertPercent !== null
                        ? `≥ ${product.discountAlertPercent}% off`
                        : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatDate(product.lastFetchedAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {product.wishlistItemId
                      ? (wishlistNames[product.wishlistItemId] ?? "—")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/products/${product.id}`}
                        className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(product.id, product.title, product.url)
                        }
                        disabled={deletingId === product.id}
                        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {deletingId === product.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Prices refresh automatically every 6 hours (12 hours for eBay and Meesho). Tracking
        pauses after 72 hours of account inactivity.
      </p>
    </section>
  );
}
