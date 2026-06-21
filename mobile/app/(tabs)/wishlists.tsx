import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { useNavigation, useRouter } from "expo-router";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { authStyles, zinc } from "@/lib/auth-styles";
import { apiFetch } from "@/lib/api-client";

type WishlistItem = {
  id: string;
  name: string;
  productCount: number;
};

type WishlistsResponse = {
  wishlists: WishlistItem[];
};

export default function WishlistsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const loadWishlists = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await apiFetch("/api/wishlists");
      if (!res.ok) {
        throw new Error(`Failed to load wishlists (${res.status})`);
      }
      const data = (await res.json()) as WishlistsResponse;
      setWishlists(data.wishlists ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load wishlists");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const createWishlist = useCallback(
    async (name: string) => {
      setCreating(true);
      setCreateError(null);

      try {
        const res = await apiFetch("/api/wishlists", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        const data = (await res.json()) as { error?: string };

        if (!res.ok) {
          setCreateError(data.error ?? "Failed to create wishlist");
          return;
        }

        setCreateModalVisible(false);
        setNewName("");
        await loadWishlists(true);
      } catch {
        setCreateError("Failed to create wishlist");
      } finally {
        setCreating(false);
      }
    },
    [loadWishlists]
  );

  const handleOpenCreate = useCallback(() => {
    setCreateError(null);
    if (Platform.OS === "ios") {
      Alert.prompt(
        "New wishlist",
        "Enter a name for your wishlist",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Create",
            onPress: (value?: string) => {
              const name = value?.trim();
              if (name) void createWishlist(name);
            },
          },
        ],
        "plain-text"
      );
      return;
    }

    setNewName("");
    setCreateModalVisible(true);
  }, [createWishlist]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleOpenCreate}
          style={{ marginRight: 15 }}
          accessibilityLabel="Create wishlist"
        >
          {({ pressed }) => (
            <SymbolView
              name={{ ios: "plus", android: "add", web: "add" }}
              size={25}
              tintColor={colors.text}
              style={{ opacity: pressed ? 0.5 : 1 }}
            />
          )}
        </Pressable>
      ),
    });
  }, [navigation, handleOpenCreate, colors.text]);

  useEffect(() => {
    void loadWishlists();
  }, [loadWishlists]);

  function handleAndroidCreate() {
    const name = newName.trim();
    if (!name) {
      setCreateError("Name is required");
      return;
    }
    void createWishlist(name);
  }

  if (loading && !refreshing) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (error && wishlists.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <Pressable
          onPress={() => void loadWishlists()}
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
        data={wishlists}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadWishlists(true)}
            tintColor={colors.text}
          />
        }
        contentContainerStyle={
          wishlists.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No wishlists yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Tap + to create your first wishlist.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/wishlists/${item.id}`)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[styles.rowTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text style={[styles.rowCount, { color: colors.muted }]}>
              {item.productCount}{" "}
              {item.productCount === 1 ? "product" : "products"}
            </Text>
          </Pressable>
        )}
      />

      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCreateModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              New wishlist
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Holiday gifts"
              placeholderTextColor={colors.muted}
              autoFocus
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  color: colors.text,
                },
              ]}
            />
            {createError ? (
              <Text style={[authStyles.error, { color: colors.error }]}>
                {createError}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setCreateModalVisible(false)}
                style={styles.modalButton}
              >
                <Text style={[styles.modalButtonText, { color: colors.muted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleAndroidCreate}
                disabled={creating}
                style={({ pressed }) => [
                  authStyles.button,
                  {
                    backgroundColor: colors.primary,
                    flex: 1,
                    opacity: pressed || creating ? 0.5 : 1,
                  },
                ]}
              >
                {creating ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text
                    style={[
                      authStyles.buttonText,
                      { color: colors.primaryText },
                    ]}
                  >
                    Create
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  rowCount: {
    fontSize: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
