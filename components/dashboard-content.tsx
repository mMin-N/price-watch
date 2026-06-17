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

      <AddProductForm onSuccess={loadProducts} />

      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading products...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <ProductList products={products} onRefresh={loadProducts} />
      )}
    </div>
  );
}
