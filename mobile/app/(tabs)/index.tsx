import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@/components/Themed";
import { ProductCard, type ProductListItem } from "@/components/product-card";
import { ProductCardSkeletonList } from "@/components/product-card-skeleton";
import { SummaryBar } from "@/components/summary-bar";
import { useColorScheme } from "@/components/useColorScheme";
import { zinc } from "@/lib/auth-styles";
import { apiFetch } from "@/lib/api-client";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notification-count";
import { sortProductsByUrgency } from "@/lib/sort-products";

type ProductsResponse = {
  products: ProductListItem[];
};

export default function ProductsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const unreadCount = useUnreadNotificationCount();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await apiFetch("/api/products");
      if (!res.ok) {
        throw new Error(`Failed to load products (${res.status})`);
      }
      const data = (await res.json()) as ProductsResponse;
      setProducts(sortProductsByUrgency(data.products ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const priceDropCount = useMemo(
    () => products.filter((product) => (product.priceChange ?? 0) < 0).length,
    [products]
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ProductCardSkeletonList />
      </View>
    );
  }

  if (error && products.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <Pressable
          onPress={() => void loadProducts()}
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.retryButtonText, { color: colors.primaryText }]}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {error ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.errorBannerText, { color: colors.error }]}>
            {error}
          </Text>
        </View>
      ) : null}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadProducts(true)}
            tintColor={colors.text}
          />
        }
        contentContainerStyle={
          products.length === 0 ? styles.emptyList : styles.list
        }
        ListHeaderComponent={
          <SummaryBar
            priceDropCount={priceDropCount}
            unreadCount={unreadCount}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No products yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Paste a product link to start tracking prices.
            </Text>
            <Pressable
              onPress={() => router.push("/products/add")}
              style={[styles.emptyCta, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.emptyCtaText, { color: colors.primaryText }]}>
                Add product
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push(`/products/${item.id}`)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  list: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    paddingTop: 4,
    paddingBottom: 24,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  emptyCta: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    fontSize: 14,
    textAlign: "center",
  },
});
