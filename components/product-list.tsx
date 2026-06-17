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

function isTargetMet(product: Product) {
  return (
    product.targetPrice !== null &&
    product.lastPrice !== null &&
    product.lastPrice <= product.targetPrice
  );
}

export function ProductList({ products, onRefresh }: ProductListProps) {
  const [wishlistNames, setWishlistNames] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
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

  async function handleRefresh(id: string) {
    setRefreshingId(id);
    setActionError(null);

    try {
      const res = await fetch(`/api/products/${id}/refresh`, { method: "POST" });
      const data = (await res.json()) as { error?: string; retryAfterSeconds?: number };

      if (res.status === 429 && data.retryAfterSeconds) {
        const minutes = Math.ceil(data.retryAfterSeconds / 60);
        setActionError(
          data.error
            ? `${data.error}. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`
            : `Refresh cooldown active. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`
        );
        return;
      }

      if (!res.ok) {
        setActionError(data.error ?? "Failed to refresh price");
        return;
      }

      onRefresh();
    } catch {
      setActionError("Failed to refresh price");
    } finally {
      setRefreshingId(null);
    }
  }

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
      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No tracked products yet. Add a URL above to get started.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {actionError && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
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
                Last price
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Target
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
              const targetMet = isTargetMet(product);
              return (
                <tr
                  key={product.id}
                  className={`border-b border-zinc-100 last:border-b-0 dark:border-zinc-800 ${
                    targetMet
                      ? "bg-green-50 dark:bg-green-950/30"
                      : "bg-white dark:bg-zinc-950"
                  }`}
                >
                  <td className="max-w-xs px-4 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {product.title ?? "Untitled product"}
                    </div>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-zinc-500 hover:underline dark:text-zinc-400"
                    >
                      {product.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    {formatPrice(product.lastPrice, product.currency)}
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    {product.targetPrice !== null
                      ? formatPrice(product.targetPrice, product.currency)
                      : "—"}
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
                        onClick={() => handleRefresh(product.id)}
                        disabled={refreshingId === product.id}
                        className="text-sm font-medium text-zinc-700 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-zinc-50"
                      >
                        {refreshingId === product.id ? "Refreshing..." : "Refresh"}
                      </button>
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
    </section>
  );
}
