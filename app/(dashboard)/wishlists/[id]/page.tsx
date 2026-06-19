"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AddProductForm } from "@/components/add-product-form";
import { ProductList } from "@/components/product-list";
import type { Product, Wishlist } from "@/lib/types/product";

export default function WishlistDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [wishlistName, setWishlistName] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProductCount, setTotalProductCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const [wishlistsRes, productsRes] = await Promise.all([
        fetch("/api/wishlists"),
        fetch("/api/products"),
      ]);

      const wishlistsData = (await wishlistsRes.json()) as {
        wishlists?: Wishlist[];
        error?: string;
      };
      const productsData = (await productsRes.json()) as {
        products?: Product[];
        error?: string;
      };

      if (!wishlistsRes.ok) {
        setError(wishlistsData.error ?? "Failed to load wishlist");
        return;
      }

      if (!productsRes.ok) {
        setError(productsData.error ?? "Failed to load products");
        return;
      }

      const wishlist = (wishlistsData.wishlists ?? []).find((w) => w.id === id);
      if (!wishlist) {
        setError("Wishlist not found");
        return;
      }

      setWishlistName(wishlist.name);
      const allProducts = productsData.products ?? [];
      setTotalProductCount(allProducts.length);
      setProducts(allProducts.filter((p) => p.wishlistItemId === id));
    } catch {
      setError("Failed to load wishlist");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/wishlists"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to wishlists
        </Link>
        {loading ? (
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Loading...
          </h1>
        ) : error ? (
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Wishlist
          </h1>
        ) : (
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {wishlistName}
          </h1>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          <AddProductForm
            wishlistItemId={id}
            onSuccess={loadData}
            productCount={totalProductCount}
          />

          {loading ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading products...</p>
          ) : (
            <ProductList products={products} onRefresh={loadData} />
          )}
        </>
      )}
    </div>
  );
}
