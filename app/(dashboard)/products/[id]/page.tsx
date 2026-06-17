"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PriceChart } from "@/components/price-chart";
import type { Product } from "@/lib/types/product";

type PriceHistoryEntry = {
  id: string;
  price: number;
  currency: string;
  provider: string;
  createdAt: string;
};

type ProductDetail = Product & {
  priceHistory: PriceHistoryEntry[];
};

function formatPrice(price: number | null, currency: string) {
  if (price === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(price);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetPriceInput, setTargetPriceInput] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/products/${id}`);
      const data = (await res.json()) as ProductDetail & { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to load product");
        setProduct(null);
        return;
      }

      setProduct(data);
      setTargetPriceInput(
        data.targetPrice !== null ? String(data.targetPrice) : ""
      );
    } catch {
      setError("Failed to load product");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  async function handleSaveTargetPrice() {
    if (!product) return;

    setSavingTarget(true);
    setActionError(null);
    setActionSuccess(null);

    const trimmed = targetPriceInput.trim();
    const targetPrice =
      trimmed === "" ? null : Number.parseFloat(trimmed);

    if (trimmed !== "" && Number.isNaN(targetPrice)) {
      setActionError("Target price must be a valid number");
      setSavingTarget(false);
      return;
    }

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPrice }),
      });
      const data = (await res.json()) as Product & { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to update target price");
        return;
      }

      setProduct((prev) =>
        prev ? { ...prev, targetPrice: data.targetPrice } : prev
      );
      setTargetPriceInput(
        data.targetPrice !== null ? String(data.targetPrice) : ""
      );
      setActionSuccess("Target price saved");
    } catch {
      setActionError("Failed to update target price");
    } finally {
      setSavingTarget(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/products/${id}/refresh`, {
        method: "POST",
      });
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

      setActionSuccess("Price refreshed");
      await loadProduct();
    } catch {
      setActionError("Failed to refresh price");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to dashboard
        </Link>
        {loading ? (
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Loading...
          </h1>
        ) : error ? (
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Product
          </h1>
        ) : (
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {product?.title ?? "Untitled product"}
          </h1>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : loading || !product ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading product details...
        </p>
      ) : (
        <>
          {(actionError || actionSuccess) && (
            <div className="space-y-2">
              {actionError && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                  {actionError}
                </p>
              )}
              {actionSuccess && (
                <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
                  {actionSuccess}
                </p>
              )}
            </div>
          )}

          <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div>
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                URL
              </h2>
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block break-all text-sm text-zinc-600 hover:underline dark:text-zinc-400"
              >
                {product.url}
              </a>
            </div>

            <div>
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Last price
              </h2>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {formatPrice(product.lastPrice, product.currency)}
              </p>
              {product.lastFetchedAt && (
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Updated {formatDate(product.lastFetchedAt)}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="target-price"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Target price
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  id="target-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={targetPriceInput}
                  onChange={(e) => setTargetPriceInput(e.target.value)}
                  placeholder="No target set"
                  className="w-40 rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                <button
                  type="button"
                  onClick={handleSaveTargetPrice}
                  disabled={savingTarget}
                  className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {savingTarget ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {refreshing ? "Refreshing..." : "Refresh price"}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Price history
            </h2>
            <PriceChart
              priceHistory={product.priceHistory.map((entry) => ({
                createdAt: entry.createdAt,
                price: entry.price,
              }))}
            />

            {product.priceHistory.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No price snapshots recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <tr>
                      <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                        Date
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.priceHistory.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                      >
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {formatPrice(entry.price, entry.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
