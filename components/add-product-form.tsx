"use client";

import { useEffect, useState } from "react";
import type { Wishlist } from "@/lib/types/product";

type AddProductFormProps = {
  onSuccess: () => void;
};

export function AddProductForm({ onSuccess }: AddProductFormProps) {
  const [url, setUrl] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [wishlistItemId, setWishlistItemId] = useState("");
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchWishlists() {
      try {
        const res = await fetch("/api/wishlists");
        if (!res.ok) return;
        const data = (await res.json()) as { wishlists?: Wishlist[] };
        if (!cancelled) {
          setWishlists(data.wishlists ?? []);
        }
      } catch {
        // ignore fetch errors for optional select
      }
    }

    fetchWishlists();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = { url: url.trim() };

    if (targetPrice.trim()) {
      const parsed = Number(targetPrice);
      if (Number.isNaN(parsed) || parsed < 0) {
        setError("Target price must be a valid number");
        setLoading(false);
        return;
      }
      body.targetPrice = parsed;
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
        setError(data.error ?? "Failed to add product");
        return;
      }

      setUrl("");
      setTargetPrice("");
      setWishlistItemId("");
      onSuccess();
    } catch {
      setError("Failed to add product");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Add Product
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="product-url"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Product URL
          </label>
          <input
            id="product-url"
            type="url"
            placeholder="https://example.com/product"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="target-price"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Target price (optional)
            </label>
            <input
              id="target-price"
              type="number"
              min="0"
              step="0.01"
              placeholder="29.99"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

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
              <option value="">None</option>
              {wishlists.map((wishlist) => (
                <option key={wishlist.id} value={wishlist.id}>
                  {wishlist.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Adding..." : "Add product"}
        </button>
      </form>
    </section>
  );
}
