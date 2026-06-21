import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import {
  formatDistanceToTarget,
  formatPriceChange,
  formatRelativeTime,
} from "@/lib/format-display";
import { zinc } from "@/lib/auth-styles";

export type ProductListItem = {
  id: string;
  url: string;
  title: string | null;
  targetPrice: number | null;
  discountAlertPercent: number | null;
  baselinePrice: number | null;
  lastPrice: number | null;
  lastFetchedAt: string | null;
  currency: string;
  siteName: string;
  alertActive: boolean;
  autoRefreshPaused: boolean;
  priceChange: number | null;
  priceChangePercent: number | null;
  distanceToTarget: number | null;
  targetMet: boolean;
  createdAt: string;
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
  const displayTitle = product.title?.trim() || "Untitled product";
  const priceChange = formatPriceChange(
    product.priceChange,
    product.priceChangePercent,
    product.currency
  );
  const distance = formatDistanceToTarget(
    product.distanceToTarget,
    product.currency
  );

  const changeColor =
    priceChange?.direction === "down"
      ? colorScheme === "dark"
        ? "#34d399"
        : "#047857"
      : priceChange?.direction === "up"
        ? colors.error
        : colors.muted;

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
      {product.autoRefreshPaused && (
        <Text
          style={[
            styles.pausedBanner,
            { color: colorScheme === "dark" ? "#fcd34d" : "#b45309" },
          ]}
        >
          Updates paused
        </Text>
      )}

      <View style={styles.topRow}>
        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={2}
        >
          {displayTitle}
        </Text>
        <Text style={[styles.price, { color: colors.text }]}>
          {formatPrice(product.lastPrice, product.currency)}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.changeRow}>
          {priceChange ? (
            <Text style={[styles.changeText, { color: changeColor }]}>
              {priceChange.text}
            </Text>
          ) : null}
          {distance ? (
            <Text
              style={[
                styles.changeText,
                {
                  color: distance.met
                    ? colorScheme === "dark"
                      ? "#34d399"
                      : "#047857"
                    : colors.muted,
                },
              ]}
            >
              {distance.text}
            </Text>
          ) : null}
        </View>
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

      <View style={styles.footerRow}>
        <Text style={[styles.siteText, { color: colors.muted }]}>
          {product.siteName}
        </Text>
        <Text style={[styles.timeText, { color: colors.muted }]}>
          {formatRelativeTime(product.lastFetchedAt)}
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
  pausedBanner: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  price: {
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
  },
  changeRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  changeText: {
    fontSize: 13,
    fontWeight: "600",
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
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  siteText: {
    fontSize: 11,
    opacity: 0.7,
    flex: 1,
  },
  timeText: {
    fontSize: 11,
  },
});
