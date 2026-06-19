import { useState } from "react";
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
import { useRouter } from "expo-router";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { authStyles, zinc } from "@/app/(auth)/auth-styles";
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
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];

  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ProductPreview | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

    try {
      const res = await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({ url: trimmedUrl }),
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

      if (data.id) {
        router.replace(`/products/${data.id}`);
      } else {
        router.replace("/(tabs)");
      }
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
