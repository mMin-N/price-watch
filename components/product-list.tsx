"use client";

import { useState } from "react";
import type { Product } from "@/lib/types/product";
import { ProductCard } from "@/components/product-card";

type ProductListProps = {
  products: Product[];
  onRefresh: () => void;
};

export function ProductList({ products, onRefresh }: ProductListProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          No products yet
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Paste a product link above to start tracking prices.
        </p>
      </div>
    );
  }

  return (
    <section>
      {actionError && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {actionError}
        </p>
      )}

      <div className="space-y-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onDelete={handleDelete}
            deleting={deletingId === product.id}
          />
        ))}
      </div>
    </section>
  );
}
