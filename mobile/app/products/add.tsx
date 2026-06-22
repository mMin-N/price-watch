import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { showToast } from "@/lib/toast";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { authStyles, zinc } from "@/lib/auth-styles";
import { apiFetch } from "@/lib/api-client";

type ProductPreview = {
  title: string;
  price: number;
  currency: string;
  site?: string;
  siteName?: string;
};

type ApiErrorBody = {
  error?: string;
  existingId?: string;
  retryAfterSeconds?: number;
};

type AddProductResponse = ApiErrorBody & {
  id?: string;
};

type WishlistItem = {
  id: string;
  name: string;
  isDefault?: boolean;
};

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(price);
}

function parseApiError(res: Response, data: ApiErrorBody): string {
  if (res.status === 403) {
    return data.error ?? "You cannot add more products.";
  }
  if (res.status === 429) {
    const retry = data.retryAfterSeconds;
    if (retry && retry > 0) {
      const minutes = Math.max(1, Math.ceil(retry / 60));
      return (
        data.error ??
        `Rate limit exceeded. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`
      );
    }
    return data.error ?? "Rate limit exceeded. Try again later.";
  }
  const extra = data.existingId ? " Remove it from your list first." : "";
  return (data.error ?? "Request failed") + extra;
}

export default function AddProductScreen() {
  const router = useRouter();
  const { wishlistId: fixedWishlistId } = useLocalSearchParams<{ wishlistId?: string }>();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];

  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ProductPreview | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discountAlertPercent, setDiscountAlertPercent] = useState("");
  const [showMinDiscount, setShowMinDiscount] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState("");
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadWishlists() {
      try {
        const res = await apiFetch("/api/wishlists");
        if (!res.ok) return;
        const data = (await res.json()) as { wishlists?: WishlistItem[] };
        if (cancelled) return;
        const list = data.wishlists ?? [];
        setWishlists(list);
        if (fixedWishlistId && list.some((w) => w.id === fixedWishlistId)) {
          setWishlistItemId(fixedWishlistId);
          return;
        }
        const defaultWishlist = list.find((w) => w.isDefault);
        if (defaultWishlist) {
          setWishlistItemId(defaultWishlist.id);
        } else if (list[0]) {
          setWishlistItemId(list[0].id);
        }
      } catch {
        // optional
      }
    }

    void loadWishlists();
    return () => {
      cancelled = true;
    };
  }, [fixedWishlistId]);

  function handleUrlChange(value: string) {
    setUrl(value);
    if (previewUrl && value.trim() !== previewUrl) {
      setPreview(null);
      setPreviewUrl(null);
    }
  }

  async function handlePreview() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Enter a product URL first");
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setError("Invalid URL");
      return;
    }

    setPreviewing(true);
    setError(null);
    setPreview(null);
    setPreviewUrl(null);

    try {
      const res = await apiFetch("/api/products/preview", {
        method: "POST",
        body: JSON.stringify({ url: trimmedUrl }),
      });

      let data = {} as Partial<ProductPreview> & ApiErrorBody;
      try {
        data = (await res.json()) as Partial<ProductPreview> & ApiErrorBody;
      } catch {
        if (!res.ok) {
          setError("Could not find product");
          return;
        }
      }

      if (!res.ok) {
        setError(parseApiError(res, data));
        return;
      }

      setPreview({
        title: data.title ?? "Unknown product",
        price: data.price ?? 0,
        currency: data.currency ?? "USD",
        site: data.site,
        siteName: data.siteName,
      });
      setPreviewUrl(trimmedUrl);
    } catch {
      setError("Could not find product. Check your connection and try again.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirm() {
    const trimmedUrl = url.trim();
    if (!preview || previewUrl !== trimmedUrl) {
      setError("Preview the product before adding");
      return;
    }

    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = { url: trimmedUrl };

    if (discountAlertPercent.trim()) {
      const parsed = Number.parseFloat(discountAlertPercent);
      if (Number.isNaN(parsed) || parsed <= 0 || parsed > 100) {
        setError("Minimum discount must be between 1 and 100");
        setSubmitting(false);
        return;
      }
      body.discountAlertPercent = parsed;
    }

    if (wishlistItemId) {
      body.wishlistItemId = wishlistItemId;
    }

    try {
      const res = await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify(body),
      });

      let data: AddProductResponse = {};
      try {
        data = (await res.json()) as AddProductResponse;
      } catch {
        if (!res.ok) {
          setError("Failed to add product");
          return;
        }
      }

      if (!res.ok) {
        setError(parseApiError(res, data));
        return;
      }

      showToast("Product added");
      router.back();
    } catch {
      setError("Failed to add product. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canConfirm = Boolean(preview && previewUrl === url.trim());

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: colors.text }]}>Product URL</Text>
        <View style={styles.urlRow}>
          <TextInput
            value={url}
            onChangeText={handleUrlChange}
            placeholder="https://example.com/product"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={() => void handlePreview()}
            style={[
              styles.urlInput,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.text,
              },
            ]}
          />
          <Pressable
            onPress={() => void handlePreview()}
            disabled={previewing || !url.trim()}
            style={({ pressed }) => [
              styles.previewButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed || previewing || !url.trim() ? 0.5 : 1,
              },
            ]}
          >
            {previewing ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={[styles.previewButtonText, { color: colors.text }]}>
                Preview
              </Text>
            )}
          </Pressable>
        </View>

        {preview ? (
          <View
            style={[
              styles.previewCard,
              {
                borderColor: colorScheme === "dark" ? "#065f46" : "#a7f3d0",
                backgroundColor: colorScheme === "dark" ? "#022c22" : "#ecfdf5",
              },
            ]}
          >
            <Text
              style={[
                styles.previewLabel,
                { color: colorScheme === "dark" ? "#34d399" : "#047857" },
              ]}
            >
              Product found
            </Text>
            <Text style={[styles.previewTitle, { color: colors.text }]}>
              {preview.title}
            </Text>
            {preview.siteName ? (
              <Text style={[styles.previewSite, { color: colors.muted }]}>
                {preview.site === "generic"
                  ? "Unsupported site — results may be inaccurate"
                  : preview.siteName}
              </Text>
            ) : null}
            <Text style={[styles.previewPrice, { color: colors.text }]}>
              {formatPrice(preview.price, preview.currency)}
            </Text>
          </View>
        ) : null}

        {preview ? (
          <View style={styles.alertFields}>
            <Text style={[styles.hintText, { color: colors.muted }]}>
              You&apos;ll be notified when the price drops from the price when added.
            </Text>

            <Pressable onPress={() => setShowMinDiscount((value) => !value)}>
              <Text style={[styles.advancedLink, { color: colors.muted }]}>
                {showMinDiscount ? "Hide minimum discount %" : "Minimum discount % (optional)"}
              </Text>
            </Pressable>

            {showMinDiscount ? (
              <>
                <TextInput
                  value={discountAlertPercent}
                  onChangeText={setDiscountAlertPercent}
                  placeholder="Any drop"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  style={[
                    styles.fieldInput,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      color: colors.text,
                    },
                  ]}
                />
                <Text style={[styles.hintText, { color: colors.muted }]}>
                  Leave empty for any drop. Set a value to require at least that % off.
                </Text>
              </>
            ) : null}

            {wishlists.length > 0 && !fixedWishlistId ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  Wishlist
                </Text>
                <View style={styles.wishlistRow}>
                  {wishlists.map((wishlist) => (
                    <Pressable
                      key={wishlist.id}
                      onPress={() => setWishlistItemId(wishlist.id)}
                      style={[
                        styles.wishlistChip,
                        {
                          borderColor: colors.border,
                          backgroundColor:
                            wishlistItemId === wishlist.id
                              ? colors.primary
                              : colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            wishlistItemId === wishlist.id
                              ? colors.primaryText
                              : colors.text,
                          fontSize: 13,
                          fontWeight: "500",
                        }}
                      >
                        {wishlist.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {error ? (
          <Text style={[authStyles.error, { color: colors.error }]}>{error}</Text>
        ) : null}

        <Pressable
          onPress={() => void handleConfirm()}
          disabled={submitting || !canConfirm}
          style={({ pressed }) => [
            authStyles.button,
            styles.confirmButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed || submitting || !canConfirm ? 0.5 : 1,
            },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[authStyles.buttonText, { color: colors.primaryText }]}>
              Add product
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          disabled={submitting}
          style={styles.cancelButton}
        >
          <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  urlRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  previewButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 88,
  },
  previewButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 8,
  },
  previewSite: {
    fontSize: 12,
    marginTop: 4,
  },
  previewPrice: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 8,
  },
  alertFields: {
    marginBottom: 16,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
  },
  advancedLink: {
    fontSize: 12,
    textDecorationLine: "underline",
    marginTop: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  wishlistRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  wishlistChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confirmButton: {
    marginTop: 8,
  },
  cancelButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 15,
  },
});
