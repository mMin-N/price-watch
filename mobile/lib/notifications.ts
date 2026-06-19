import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { apiFetch } from "./api-client";

const PUSH_TOKEN_KEY = "fcm_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getStoredPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const tokenResult = await Notifications.getDevicePushTokenAsync();
  const fcmToken = tokenResult.data;

  const res = await apiFetch("/api/devices/register", {
    method: "POST",
    body: JSON.stringify({
      fcmToken,
      platform: Platform.OS,
    }),
  });

  if (!res.ok) {
    return null;
  }

  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, fcmToken);
  return fcmToken;
}

export async function unregisterPushNotifications(token: string): Promise<void> {
  if (!token.trim()) return;

  await apiFetch("/api/devices/register", {
    method: "DELETE",
    body: JSON.stringify({ fcmToken: token.trim() }),
  });

  const stored = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (stored === token.trim()) {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  }
}

export function setupNotificationResponseListener(router: {
  push: (href: `/products/${string}`) => void;
}): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const productId = response.notification.request.content.data?.productId;
      if (typeof productId === "string" && productId) {
        router.push(`/products/${productId}`);
      }
    }
  );

  return () => subscription.remove();
}
