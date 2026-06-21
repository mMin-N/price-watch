"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddProductForm } from "@/components/add-product-form";
import { ProductCardSkeletonList } from "@/components/product-card-skeleton";
import { ProductList } from "@/components/product-list";
import { SummaryBar } from "@/components/summary-bar";
import { sortProductsByUrgency } from "@/lib/products/sort-products";
import type { Product } from "@/lib/types/product";

export function DashboardContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadProducts = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/products");
      const data = (await res.json()) as { products?: Product[]; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to load products");
        return;
      }

      setProducts(sortProductsByUrgency(data.products ?? []));
    } catch {
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unreadOnly=true");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: unknown[] };
      setUnreadCount(data.notifications?.length ?? 0);
    } catch {
      // ignore badge fetch errors
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    void loadUnreadCount();
  }, [loadProducts, loadUnreadCount]);

  const priceDropCount = useMemo(
    () => products.filter((product) => (product.priceChange ?? 0) < 0).length,
    [products]
  );

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

      {!loading && !error ? (
        <SummaryBar priceDropCount={priceDropCount} unreadCount={unreadCount} />
      ) : null}

      <AddProductForm
        onSuccess={() => {
          void loadProducts();
          void loadUnreadCount();
        }}
        disabled={Boolean(error)}
        productCount={products.length}
      />

      {loading ? (
        <ProductCardSkeletonList />
      ) : error ? null : (
        <ProductList products={products} onRefresh={loadProducts} />
      )}
    </div>
  );
}
