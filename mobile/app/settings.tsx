import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { zinc } from "@/lib/auth-styles";
import { apiFetch } from "@/lib/api-client";
import {
  getStoredPushToken,
  registerForPushNotifications,
  unregisterPushNotifications,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

type ProfileResponse = {
  email?: string;
  emailVerified?: boolean;
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL!;

function permissionLabel(status: Notifications.PermissionStatus | null): string {
  switch (status) {
    case "granted":
      return "Enabled";
    case "denied":
      return "Denied — enable in system settings for push alerts";
    case "undetermined":
      return "Not requested yet";
    default:
      return "Unknown";
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const [email, setEmail] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshingPermission, setRefreshingPermission] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, permission] = await Promise.all([
        apiFetch("/api/profile"),
        Notifications.getPermissionsAsync(),
      ]);

      if (profileRes.ok) {
        const data = (await profileRes.json()) as ProfileResponse;
        setEmail(data.email ?? null);
      }

      setPermissionStatus(permission.status);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleEnableNotifications() {
    setRefreshingPermission(true);
    try {
      await registerForPushNotifications();
      const permission = await Notifications.getPermissionsAsync();
      setPermissionStatus(permission.status);
    } finally {
      setRefreshingPermission(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const token = await getStoredPushToken();
      if (token) {
        await unregisterPushNotifications(token);
      }
      await supabase.auth.signOut();
      router.replace("/(auth)/login");
    } finally {
      setLoggingOut(false);
    }
  }

  function openLink(path: "/privacy" | "/terms") {
    void Linking.openURL(`${API_BASE}${path}`);
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>Account</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {email ?? "—"}
        </Text>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>
          Push notifications
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {permissionLabel(permissionStatus)}
        </Text>
        {permissionStatus !== "granted" ? (
          <Pressable
            onPress={() => void handleEnableNotifications()}
            disabled={refreshingPermission}
            style={[
              styles.secondaryButton,
              { borderColor: colors.border },
              refreshingPermission && { opacity: 0.6 },
            ]}
          >
            {refreshingPermission ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                Enable notifications
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>
          How tracking works
        </Text>
        <Text style={[styles.helpText, { color: colors.text }]}>
          Prices refresh automatically every 6 hours (12 hours for eBay and Meesho).
        </Text>
        <Text style={[styles.helpText, { color: colors.text }]}>
          Tracking pauses after 72 hours of account inactivity.
        </Text>
        <Text style={[styles.helpText, { color: colors.text }]}>
          Auto-refresh may pause on a product after repeated fetch failures.
        </Text>
        <Text style={[styles.helpText, { color: colors.text }]}>
          Supported sites: Amazon, Flipkart, Meesho, eBay, plus generic HTML fallback.
        </Text>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>Legal</Text>
        <Pressable onPress={() => openLink("/privacy")} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.link }]}>Privacy policy</Text>
        </Pressable>
        <Pressable onPress={() => openLink("/terms")} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.link }]}>Terms of service</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => void handleLogout()}
        disabled={loggingOut}
        style={[
          styles.logoutButton,
          { backgroundColor: colors.error },
          loggingOut && { opacity: 0.6 },
        ]}
      >
        {loggingOut ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.logoutButtonText}>Log out</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 20,
  },
  secondaryButton: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  linkRow: {
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 16,
    textDecorationLine: "underline",
  },
  logoutButton: {
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
