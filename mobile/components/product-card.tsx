import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { zinc } from "@/app/(auth)/auth-styles";

export type ProductListItem = {
  id: string;
  url: string;
  title: string | null;
  lastPrice: number | null;
  currency: string;
  siteName: string;
  alertActive: boolean;
};

function formatPrice(price: number | null, currency: string) {
  if (price === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(price);
}

type ProductCardProps = {
  product: ProductListItem;
  onPress: () => void;
};

export function ProductCard({ product, onPress }: ProductCardProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const displayTitle = product.title?.trim() || product.url;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={2}
        >
          {displayTitle}
        </Text>
        {product.alertActive && (
          <View
            style={[
              styles.alertBadge,
              {
                backgroundColor: colorScheme === "dark" ? "#14532d" : "#dcfce7",
              },
            ]}
          >
            <Text
              style={[
                styles.alertText,
                { color: colorScheme === "dark" ? "#86efac" : "#166534" },
              ]}
            >
              Alert
            </Text>
          </View>
        )}
      </View>
      <View style={styles.metaRow}>
        <View
          style={[
            styles.siteBadge,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.siteBadgeText, { color: colors.muted }]}>
            {product.siteName}
          </Text>
        </View>
        <Text style={[styles.price, { color: colors.text }]}>
          {formatPrice(product.lastPrice, product.currency)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  alertBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  alertText: {
    fontSize: 11,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  siteBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  siteBadgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  price: {
    fontSize: 16,
    fontWeight: "600",
  },
});
