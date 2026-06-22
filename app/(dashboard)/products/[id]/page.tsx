"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PriceChart } from "@/components/price-chart";
import { useToast } from "@/components/toast";
import { formatRelativeTime } from "@/lib/format/display";
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
  priceHistoryTotal?: number;
  priceHistoryLimit?: number;
  priceHistoryOffset?: number;
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
  const router = useRouter();
  const id = params.id as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discountAlertInput, setDiscountAlertInput] = useState("");
  const [showAdvancedAlerts, setShowAdvancedAlerts] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { showToast } = useToast();

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
      setDiscountAlertInput(
        data.discountAlertPercent !== null ? String(data.discountAlertPercent) : ""
      );
      setShowAdvancedAlerts(data.discountAlertPercent !== null);
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

  async function openProductUrl(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleSaveAlerts() {
    if (!product) return;

    setSavingAlerts(true);
    setActionError(null);

    const discountTrimmed = discountAlertInput.trim();
    const discountAlertPercent =
      discountTrimmed === "" ? null : Number.parseFloat(discountTrimmed);

    if (
      discountTrimmed !== "" &&
      (Number.isNaN(discountAlertPercent) ||
        discountAlertPercent! <= 0 ||
        discountAlertPercent! > 100)
    ) {
      setActionError("Minimum discount must be between 1 and 100");
      setSavingAlerts(false);
      return;
    }

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountAlertPercent }),
      });
      const data = (await res.json()) as Product & { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to update alert settings");
        return;
      }

      setProduct((prev) =>
        prev
          ? {
              ...prev,
              discountAlertPercent: data.discountAlertPercent,
            }
          : prev
      );
      setDiscountAlertInput(
        data.discountAlertPercent !== null ? String(data.discountAlertPercent) : ""
      );
      showToast("Alert settings saved");
    } catch {
      setActionError("Failed to update alert settings");
    } finally {
      setSavingAlerts(false);
    }
  }

  async function handleDelete() {
    if (!product) return;
    const label = product.title ?? product.url;
    if (!window.confirm(`Stop tracking "${label}"?`)) return;

    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Failed to delete product");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setActionError("Failed to delete product");
    } finally {
      setDeleting(false);
    }
  }

  async function handleLoadMoreHistory() {
    if (!product) return;
    setLoadingMoreHistory(true);
    setActionError(null);
    try {
      const offset = product.priceHistory.length;
      const res = await fetch(`/api/products/${id}?limit=90&offset=${offset}`);
      const data = (await res.json()) as ProductDetail & { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Failed to load more history");
        return;
      }
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              ...data,
              priceHistory: [...prev.priceHistory, ...(data.priceHistory ?? [])],
            }
          : prev
      );
    } catch {
      setActionError("Failed to load more history");
    } finally {
      setLoadingMoreHistory(false);
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
          {actionError ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {actionError}
            </p>
          ) : null}

          <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {product.site === "generic" ? "Unsupported site" : product.siteName}
              </span>
              {product.availabilityStatus === "out_of_stock" && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Out of stock
                </span>
              )}
              {product.alertActive && (
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                  Alert active
                </span>
              )}
            </div>

            {product.imageUrl ? (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.title ?? "Product"}
                  className="max-h-80 w-full object-contain"
                />
              </a>
            ) : null}

            <div>
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Last price
              </h2>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {formatPrice(product.lastPrice, product.currency)}
              </p>
              {product.lastFetchedAt && (
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Updated {formatRelativeTime(product.lastFetchedAt)}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => openProductUrl(product.url)}
              className="text-sm font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Open in browser
            </button>

            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Price drop alerts
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                You&apos;ll be notified when the price drops from the price when added.
              </p>
              {product.baselinePrice !== null && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Price when added: {formatPrice(product.baselinePrice, product.currency)}
                </p>
              )}

              <button
                type="button"
                onClick={() => setShowAdvancedAlerts((value) => !value)}
                className="mt-3 text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                {showAdvancedAlerts ? "Hide" : "Set minimum discount %"}
              </button>

              {showAdvancedAlerts ? (
                <div className="mt-2">
                  <label
                    htmlFor="discount-alert"
                    className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    Minimum discount %
                  </label>
                  <input
                    id="discount-alert"
                    type="number"
                    min="1"
                    max="100"
                    step="0.1"
                    value={discountAlertInput}
                    onChange={(e) => setDiscountAlertInput(e.target.value)}
                    placeholder="Any drop"
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Leave empty for any price drop. Set a value to require at least that % off.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveAlerts}
                    disabled={savingAlerts}
                    className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {savingAlerts ? "Saving..." : "Save"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                {deleting ? "Deleting..." : "Stop tracking"}
              </button>
            </div>
            {product.autoRefreshPaused && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Updates paused after repeated fetch failures.
              </p>
            )}
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

            {product.priceHistoryTotal !== undefined &&
              product.priceHistory.length < product.priceHistoryTotal && (
                <button
                  type="button"
                  onClick={handleLoadMoreHistory}
                  disabled={loadingMoreHistory}
                  className="text-sm font-medium text-zinc-700 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300"
                >
                  {loadingMoreHistory ? "Loading..." : "Load more history"}
                </button>
              )}
          </section>
        </>
      )}
    </div>
  );
}
