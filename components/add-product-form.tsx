"use client";

import { useEffect, useState } from "react";
import type { Wishlist } from "@/lib/types/product";

type ProductPreview = {
  title: string;
  price: number;
  currency: string;
  imageUrl?: string | null;
  site?: string;
  siteName?: string;
};

import { MAX_TRACKED_PRODUCTS_PER_USER } from "@/lib/tracking/tracking-policy";
import { useToast } from "@/components/toast";

type AddProductFormProps = {
  onSuccess: () => void;
  wishlistItemId?: string;
  disabled?: boolean;
  productCount?: number;
};

function formatUsd(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function AddProductForm({
  onSuccess,
  wishlistItemId: fixedWishlistItemId,
  disabled = false,
  productCount = 0,
}: AddProductFormProps) {
  const atProductLimit = productCount >= MAX_TRACKED_PRODUCTS_PER_USER;
  const formDisabled = disabled || atProductLimit;
  const [url, setUrl] = useState("");
  const [discountAlertPercent, setDiscountAlertPercent] = useState("");
  const [wishlistItemId, setWishlistItemId] = useState(fixedWishlistItemId ?? "");
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [preview, setPreview] = useState<ProductPreview | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;

    async function fetchWishlists() {
      try {
        const res = await fetch("/api/wishlists");
        if (!res.ok) return;
        const data = (await res.json()) as { wishlists?: Wishlist[] };
        if (!cancelled) {
          const list = data.wishlists ?? [];
          setWishlists(list);
          const defaultWishlist = list.find((w) => w.isDefault);
          if (defaultWishlist && !fixedWishlistItemId) {
            setWishlistItemId(defaultWishlist.id);
          }
        }
      } catch {
        // ignore fetch errors for optional select
      }
    }

    if (!fixedWishlistItemId) {
      fetchWishlists();
    }
    return () => {
      cancelled = true;
    };
  }, [fixedWishlistItemId]);

  function handleUrlChange(value: string) {
    setUrl(value);
    if (previewUrl && value.trim() !== previewUrl) {
      setPreview(null);
      setPreviewUrl(null);
    }
  }

  async function handleFindProduct() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Enter a product URL first");
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setError("Invalid URL");
      return;
    }

    setFinding(true);
    setError(null);
    setPreview(null);
    setPreviewUrl(null);

    try {
      const res = await fetch("/api/products/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = (await res.json()) as ProductPreview & { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Could not find product");
        return;
      }

      setPreview({
        title: data.title,
        price: data.price,
        currency: data.currency ?? "USD",
        imageUrl: data.imageUrl ?? null,
        site: data.site,
        siteName: data.siteName,
      });
      setPreviewUrl(trimmedUrl);
    } catch {
      setError("Could not find product");
    } finally {
      setFinding(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!preview || previewUrl !== url.trim()) {
      setError("Find and confirm the product before adding");
      return;
    }

    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = {
      url: url.trim(),
    };

    if (discountAlertPercent.trim()) {
      const parsed = Number(discountAlertPercent);
      if (Number.isNaN(parsed) || parsed <= 0 || parsed > 100) {
        setError("Minimum discount must be between 1 and 100");
        setLoading(false);
        return;
      }
      body.discountAlertPercent = parsed;
    }

    if (wishlistItemId) {
      body.wishlistItemId = wishlistItemId;
    }

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        const extra = (data as { existingId?: string }).existingId
          ? " Remove it from your list first or delete it in the dashboard."
          : "";
        setError((data.error ?? "Failed to add product") + extra);
        return;
      }

      setUrl("");
      setDiscountAlertPercent("");
      setPreview(null);
      setPreviewUrl(null);
      setExpanded(false);
      if (!fixedWishlistItemId) {
        setWishlistItemId("");
      }
      showToast("Product added");
      onSuccess();
    } catch {
      setError("Failed to add product");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className="text-base font-medium text-zinc-900 dark:text-zinc-50">
          Add Product
        </span>
        <span
          className={`text-zinc-500 transition-transform dark:text-zinc-400 ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-900">
      {atProductLimit && (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          You are tracking {MAX_TRACKED_PRODUCTS_PER_USER} products (the maximum). Remove one
          to add another.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={formDisabled} className="space-y-4 disabled:opacity-60">
        <div>
          <label
            htmlFor="product-url"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Product URL
          </label>
          <div className="flex gap-2">
            <input
              id="product-url"
              type="url"
              placeholder="https://example.com/product"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              required
              className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={handleFindProduct}
              disabled={finding || !url.trim()}
              className="shrink-0 rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100"
            >
              {finding ? "Finding..." : "Find product"}
            </button>
          </div>
        </div>

        {preview && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Product found
            </p>
            <div className="mt-2 flex gap-3">
              {preview.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.imageUrl}
                  alt={preview.title}
                  className="h-20 w-20 shrink-0 rounded-md object-cover"
                />
              ) : null}
              <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {preview.title}
            </p>
            {preview.siteName && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {preview.site === "generic"
                  ? "Unsupported site — results may be inaccurate"
                  : preview.siteName}
              </p>
            )}
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {formatUsd(preview.price)}
            </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          You&apos;ll be notified when the price drops from the price when added.
        </p>

        {!fixedWishlistItemId ? (
          <div>
            <label
              htmlFor="wishlist"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Wishlist (optional)
            </label>
            <select
              id="wishlist"
              value={wishlistItemId}
              onChange={(e) => setWishlistItemId(e.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {wishlists.map((wishlist) => (
                <option key={wishlist.id} value={wishlist.id}>
                  {wishlist.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <details className="text-xs text-zinc-500 dark:text-zinc-400">
          <summary className="cursor-pointer select-none text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
            Minimum discount % (optional)
          </summary>
          <div className="mt-2">
            <input
              id="discount-alert"
              type="number"
              min="1"
              max="100"
              step="0.1"
              placeholder="Any drop"
              value={discountAlertPercent}
              onChange={(e) => setDiscountAlertPercent(e.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <p className="mt-1">
              Leave empty to notify on any price drop. Set a value to require at least that % off.
            </p>
          </div>
        </details>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !preview || disabled}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Adding..." : "Add product"}
        </button>
        </fieldset>
      </form>
        </div>
      ) : null}
    </section>
  );
}
