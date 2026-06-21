import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { zinc } from "@/lib/auth-styles";
import { apiFetch } from "@/lib/api-client";

type Notification = {
  id: string;
  trackedProductId: string | null;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  notifications: Notification[];
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function isUnread(notification: Notification) {
  return notification.readAt === null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter(isUnread).length;

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await apiFetch("/api/notifications");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Failed to load notifications (${res.status})`);
      }
      const data = (await res.json()) as NotificationsResponse;
      setNotifications(data.notifications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    setMarkingId(id);
    setActionError(null);

    try {
      const res = await apiFetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      const data = (await res.json()) as Notification & { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to mark notification as read");
        return false;
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: data.readAt } : n))
      );
      return true;
    } catch {
      setActionError("Failed to mark notification as read");
      return false;
    } finally {
      setMarkingId(null);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    setActionError(null);

    try {
      const res = await apiFetch("/api/notifications/read-all", {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to mark all as read");
        return;
      }

      await loadNotifications(true);
    } catch {
      setActionError("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }, [loadNotifications]);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      if (isUnread(notification)) {
        const ok = await markRead(notification.id);
        if (!ok) return;
      }

      if (notification.trackedProductId) {
        router.push(`/products/${notification.trackedProductId}`);
      }
    },
    [markRead, router]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight:
        unreadCount > 0
          ? () => (
              <Pressable
                onPress={() => void handleMarkAllRead()}
                disabled={markingAll}
                style={{ marginRight: 15, opacity: markingAll ? 0.5 : 1 }}
                accessibilityLabel="Mark all read"
              >
                <Text style={[styles.headerAction, { color: colors.text }]}>
                  {markingAll ? "Marking..." : "Mark all read"}
                </Text>
              </Pressable>
            )
          : undefined,
    });
  }, [navigation, unreadCount, markingAll, handleMarkAllRead, colors.text]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  if (loading && !refreshing) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <Pressable
          onPress={() => void loadNotifications()}
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

      {actionError ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.errorBannerText, { color: colors.error }]}>
            {actionError}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadNotifications(true)}
            tintColor={colors.text}
          />
        }
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No notifications yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Price alerts will appear here when a product reaches your target
              price.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const unread = isUnread(item);
          const busy = markingId === item.id;

          return (
            <Pressable
              onPress={() => void handleNotificationPress(item)}
              disabled={busy}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: unread ? colors.surface : colors.background,
                  borderColor: colors.border,
                  opacity: pressed || busy ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.message,
                  {
                    color: colors.text,
                    fontWeight: unread ? "600" : "400",
                  },
                ]}
              >
                {item.message}
              </Text>
              <Text style={[styles.date, { color: colors.muted }]}>
                {formatDate(item.createdAt)}
              </Text>
              {busy ? (
                <ActivityIndicator
                  size="small"
                  color={colors.muted}
                  style={styles.rowSpinner}
                />
              ) : null}
            </Pressable>
          );
        }}
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
  message: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  date: {
    fontSize: 12,
  },
  rowSpinner: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  headerAction: {
    fontSize: 14,
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
