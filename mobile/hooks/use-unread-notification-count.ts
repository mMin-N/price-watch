import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { apiFetch } from "@/lib/api-client";

export function useUnreadNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notifications?unreadOnly=true");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: unknown[] };
      setUnreadCount(data.notifications?.length ?? 0);
    } catch {
      // ignore badge fetch errors
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadUnreadCount();
    }, [loadUnreadCount])
  );

  return unreadCount;
}
