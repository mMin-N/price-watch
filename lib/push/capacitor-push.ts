import {
  clearStoredPushToken,
  getStoredPushToken,
  isCapacitorNative,
  setStoredPushToken,
} from "@/lib/capacitor";

export type PushPermissionState = "prompt" | "granted" | "denied" | "unsupported";

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (!isCapacitorNative()) return "unsupported";

  const { PushNotifications } = await import("@capacitor/push-notifications");
  const status = await PushNotifications.checkPermissions();
  if (status.receive === "granted") return "granted";
  if (status.receive === "denied") return "denied";
  return "prompt";
}

export async function registerCapacitorPush(): Promise<string | null> {
  if (!isCapacitorNative()) return null;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return null;

  const token = await new Promise<string | null>((resolve) => {
    let settled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    const finish = async (value: string | null) => {
      if (settled) return;
      settled = true;
      await Promise.all(handles.map((h) => h.remove()));
      resolve(value);
    };

    void (async () => {
      handles.push(
        await PushNotifications.addListener("registration", (t) => {
          void finish(t.value);
        })
      );
      handles.push(
        await PushNotifications.addListener("registrationError", () => {
          void finish(null);
        })
      );
      await PushNotifications.register();
    })();

    setTimeout(() => void finish(null), 15_000);
  });

  if (!token) return null;

  const res = await fetch("/api/devices/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcmToken: token, platform: "android" }),
  });

  if (!res.ok) return null;

  setStoredPushToken(token);
  return token;
}

export async function unregisterCapacitorPush(): Promise<void> {
  const token = getStoredPushToken();
  if (!token?.trim()) return;

  await fetch("/api/devices/register", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcmToken: token.trim() }),
  });

  clearStoredPushToken();
}

export function setupCapacitorPushNavigation(
  navigate: (path: string) => void
): () => void {
  if (!isCapacitorNative()) return () => undefined;

  let removed = false;
  const cleanups: Array<() => void> = [];

  void (async () => {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const actionSub = await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (event) => {
        const productId = event.notification.data?.productId;
        if (typeof productId === "string" && productId) {
          navigate(`/products/${productId}`);
        }
      }
    );
    cleanups.push(() => void actionSub.remove());

    if (removed) {
      for (const fn of cleanups) fn();
    }
  })();

  return () => {
    removed = true;
    for (const fn of cleanups) fn();
  };
}

export function pushPermissionLabel(state: PushPermissionState): string {
  switch (state) {
    case "granted":
      return "Enabled";
    case "denied":
      return "Denied — enable in system settings for push alerts";
    case "prompt":
      return "Not requested yet";
    default:
      return "Not available in browser";
  }
}
