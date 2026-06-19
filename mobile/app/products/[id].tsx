import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LineChart } from "react-native-gifted-charts";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { authStyles, zinc } from "@/app/(auth)/auth-styles";
import { apiFetch } from "@/lib/api-client";

type AvailabilityStatus = "in_stock" | "out_of_stock" | "unknown";

type PriceHistoryEntry = {
  id: string;
  price: number;
  currency: string;
  provider: string;
  createdAt: string;
};

type ProductDetail = {
  id: string;
  url: string;
  title: string | null;
  targetPrice: number | null;
  discountAlertPercent: number | null;
  currency: string;
  lastPrice: number | null;
  siteName: string;
  availabilityStatus: AvailabilityStatus;
  alertActive: boolean;
  priceHistory: PriceHistoryEntry[];
};

function formatPrice(price: number | null, currency: string) {
  if (price === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(price);
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetPriceInput, setTargetPriceInput] = useState("");
  const [discountAlertInput, setDiscountAlertInput] = useState("");
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!id) return;

    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch(`/api/products/${id}`);
      const data = (await res.json()) as ProductDetail & { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to load product");
        setProduct(null);
        return;
      }

      setProduct(data);
      setTargetPriceInput(
        data.targetPrice !== null ? String(data.targetPrice) : ""
      );
      setDiscountAlertInput(
        data.discountAlertPercent !== null
          ? String(data.discountAlertPercent)
          : ""
      );
    } catch {
      setError("Failed to load product");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const chartData = useMemo(() => {
    if (!product?.priceHistory.length) return [];

    return [...product.priceHistory]
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .map((entry) => ({
        value: entry.price,
        label: formatShortDate(entry.createdAt),
      }));
  }, [product?.priceHistory]);

  const chartWidth = Math.max(windowWidth - 80, 240);

  async function handleSaveAlerts() {
    if (!product || !id) return;

    setSavingAlerts(true);
    setActionError(null);
    setActionSuccess(null);

    const targetTrimmed = targetPriceInput.trim();
    const targetPrice =
      targetTrimmed === "" ? null : Number.parseFloat(targetTrimmed);

    if (targetTrimmed !== "" && (Number.isNaN(targetPrice) || targetPrice! < 0)) {
      setActionError("Target price must be a non-negative number");
      setSavingAlerts(false);
      return;
    }

    const discountTrimmed = discountAlertInput.trim();
    const discountAlertPercent =
      discountTrimmed === "" ? null : Number.parseFloat(discountTrimmed);

    if (
      discountTrimmed !== "" &&
      (Number.isNaN(discountAlertPercent) ||
        discountAlertPercent! <= 0 ||
        discountAlertPercent! > 100)
    ) {
      setActionError("Discount alert must be between 1 and 100");
      setSavingAlerts(false);
      return;
    }

    try {
      const res = await apiFetch(`/api/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ targetPrice, discountAlertPercent }),
      });
      const data = (await res.json()) as ProductDetail & { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to update alert settings");
        return;
      }

      setProduct((prev) =>
        prev
          ? {
              ...prev,
              targetPrice: data.targetPrice,
              discountAlertPercent: data.discountAlertPercent,
            }
          : prev
      );
      setTargetPriceInput(
        data.targetPrice !== null ? String(data.targetPrice) : ""
      );
      setDiscountAlertInput(
        data.discountAlertPercent !== null
          ? String(data.discountAlertPercent)
          : ""
      );
      setActionSuccess("Alert settings saved");
    } catch {
      setActionError("Failed to update alert settings");
    } finally {
      setSavingAlerts(false);
    }
  }

  function handleDelete() {
    if (!product || !id) return;

    const label = product.title?.trim() || product.url;
    Alert.alert(
      "Stop tracking",
      `Stop tracking "${label}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void confirmDelete(),
        },
      ]
    );
  }

  async function confirmDelete() {
    if (!id) return;

    setDeleting(true);
    setActionError(null);

    try {
      const res = await apiFetch(`/api/products/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to delete product");
        return;
      }

      router.back();
    } catch {
      setActionError("Failed to delete product");
    } finally {
      setDeleting(false);
    }
  }

  async function openUrl(url: string) {
    await WebBrowser.openBrowserAsync(url);
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error ?? "Product not found"}
        </Text>
        <Pressable
          onPress={() => void loadProduct()}
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.retryButtonText, { color: colors.primaryText }]}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  const displayTitle = product.title?.trim() || "Untitled product";

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>{displayTitle}</Text>

        <View style={styles.badgeRow}>
          <View
            style={[
              styles.siteBadge,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.siteBadgeText, { color: colors.muted }]}>
              {product.siteName}
            </Text>
          </View>
          {product.availabilityStatus === "out_of_stock" && (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#78350f" : "#fef3c7",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: colorScheme === "dark" ? "#fcd34d" : "#92400e" },
                ]}
              >
                Out of stock
              </Text>
            </View>
          )}
          {product.alertActive && (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#14532d" : "#dcfce7",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: colorScheme === "dark" ? "#86efac" : "#166534" },
                ]}
              >
                Alert active
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>URL</Text>
          <Pressable onPress={() => void openUrl(product.url)}>
            <Text style={[styles.url, { color: colors.link }]}>{product.url}</Text>
          </Pressable>

          <Text style={[styles.sectionLabel, styles.sectionSpacing, { color: colors.muted }]}>
            Last price
          </Text>
          <Text style={[styles.lastPrice, { color: colors.text }]}>
            {formatPrice(product.lastPrice, product.currency)}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Price history
          </Text>
          {chartData.length === 0 ? (
            <Text style={[styles.emptyChart, { color: colors.muted }]}>
              No price history yet.
            </Text>
          ) : (
            <View style={styles.chartContainer}>
              <LineChart
                data={chartData}
                width={chartWidth}
                height={200}
                color={colors.text}
                thickness={2}
                dataPointsColor={colors.text}
                dataPointsRadius={3}
                hideRules
                yAxisColor={colors.border}
                xAxisColor={colors.border}
                yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
                noOfSections={4}
                curved
                spacing={Math.max(
                  chartWidth / Math.max(chartData.length, 2) - 8,
                  20
                )}
              />
            </View>
          )}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Alert settings
          </Text>
          <Text style={[styles.hint, { color: colors.muted }]}>
            Notify when either condition is met
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.muted }]}>
            Target price USD
          </Text>
          <TextInput
            value={targetPriceInput}
            onChangeText={setTargetPriceInput}
            placeholder="No target"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                color: colors.text,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: colors.muted }]}>
            Discount alert %
          </Text>
          <TextInput
            value={discountAlertInput}
            onChangeText={setDiscountAlertInput}
            placeholder="e.g. 20"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                color: colors.text,
              },
            ]}
          />

          {actionError ? (
            <Text style={[authStyles.error, { color: colors.error }]}>
              {actionError}
            </Text>
          ) : null}
          {actionSuccess ? (
            <Text
              style={[
                styles.successText,
                { color: colorScheme === "dark" ? "#86efac" : "#166534" },
              ]}
            >
              {actionSuccess}
            </Text>
          ) : null}

          <Pressable
            onPress={() => void handleSaveAlerts()}
            disabled={savingAlerts}
            style={({ pressed }) => [
              authStyles.button,
              {
                backgroundColor: colors.primary,
                opacity: pressed || savingAlerts ? 0.5 : 1,
              },
            ]}
          >
            {savingAlerts ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text
                style={[authStyles.buttonText, { color: colors.primaryText }]}
              >
                Save alerts
              </Text>
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={handleDelete}
          disabled={deleting}
          style={({ pressed }) => [
            styles.deleteButton,
            {
              borderColor: colorScheme === "dark" ? "#7f1d1d" : "#fca5a5",
              opacity: pressed || deleting ? 0.5 : 1,
            },
          ]}
        >
          {deleting ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Text style={[styles.deleteButtonText, { color: colors.error }]}>
              Stop tracking
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
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
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  sectionSpacing: {
    marginTop: 16,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  url: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    textDecorationLine: "underline",
  },
  lastPrice: {
    fontSize: 22,
    fontWeight: "600",
    marginTop: 4,
  },
  emptyChart: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 48,
  },
  chartContainer: {
    alignItems: "center",
    marginTop: 8,
    overflow: "hidden",
  },
  hint: {
    fontSize: 13,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  successText: {
    fontSize: 14,
    marginBottom: 8,
  },
  deleteButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  deleteButtonText: {
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
});
