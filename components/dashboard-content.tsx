"use client";

import { useCallback, useEffect, useState } from "react";
import { AddProductForm } from "@/components/add-product-form";
import { ProductList } from "@/components/product-list";
import type { Product } from "@/lib/types/product";

export function DashboardContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/products");
      const data = (await res.json()) as { products?: Product[]; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to load products");
        return;
      }

      setProducts(data.products ?? []);
    } catch {
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Tracked Products
      </h1>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <AddProductForm
        onSuccess={loadProducts}
        disabled={Boolean(error)}
        productCount={products.length}
      />

      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading products...</p>
      ) : error ? null : (
        <ProductList products={products} onRefresh={loadProducts} />
      )}
    </div>
  );
}
