import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";

import { Text } from "@/components/Themed";
import { ProductCard, type ProductListItem } from "@/components/product-card";
import { useColorScheme } from "@/components/useColorScheme";
import { zinc } from "@/lib/auth-styles";
import { apiFetch } from "@/lib/api-client";

type WishlistDetailResponse = {
  id: string;
  name: string;
  productCount: number;
  products: ProductListItem[];
  error?: string;
};

export default function WishlistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];

  const [wishlistName, setWishlistName] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWishlist = useCallback(
    async (isRefresh = false) => {
      if (!id) return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await apiFetch(`/api/wishlists/${id}`);
        const data = (await res.json()) as WishlistDetailResponse;

        if (!res.ok) {
          setError(data.error ?? "Failed to load wishlist");
          setWishlistName(null);
          setProducts([]);
          return;
        }

        setWishlistName(data.name);
        setProducts(data.products ?? []);
      } catch {
        setError("Failed to load wishlist");
        setWishlistName(null);
        setProducts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: wishlistName ?? "Wishlist",
    });
  }, [navigation, wishlistName]);

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  if (loading && !refreshing) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (error && !wishlistName) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <Pressable
          onPress={() => void loadWishlist()}
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
            onRefresh={() => void loadWishlist(true)}
            tintColor={colors.text}
          />
        }
        contentContainerStyle={
          products.length === 0 ? styles.emptyList : styles.list
        }
        ListHeaderComponent={
          id ? (
            <Pressable
              onPress={() => router.push(`/products/add?wishlistId=${id}`)}
              style={[
                styles.addButton,
                { backgroundColor: colors.primary, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.addButtonText, { color: colors.primaryText }]}>
                Add product to this wishlist
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No products in this wishlist
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Tap Add above to track a product in this wishlist.
            </Text>
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
    paddingTop: 12,
    paddingBottom: 24,
  },
  addButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  emptyList: {
    flexGrow: 1,
    paddingTop: 12,
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
