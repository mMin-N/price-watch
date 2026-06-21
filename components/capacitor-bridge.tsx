"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isCapacitorNative } from "@/lib/capacitor";
import { registerNativeOAuthListener } from "@/lib/auth/native-oauth";
import {
  registerCapacitorPush,
  setupCapacitorPushNavigation,
} from "@/lib/push/capacitor-push";

/**
 * Wires Capacitor native features when the WebView shell loads this site.
 */
export function CapacitorBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isCapacitorNative()) return;

    document.documentElement.classList.add("capacitor-native");
    document.body.classList.add("capacitor-native");

    const cleanups: Array<() => void> = [];

    void (async () => {
      cleanups.push(
        await registerNativeOAuthListener(() => {
          router.replace("/");
          router.refresh();
        })
      );
      cleanups.push(
        setupCapacitorPushNavigation((path) => {
          router.push(path);
        })
      );

      const { App } = await import("@capacitor/app");
      const backSub = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          void App.exitApp();
        }
      });
      cleanups.push(() => void backSub.remove());
    })();

    return () => {
      for (const fn of cleanups) fn();
      document.documentElement.classList.remove("capacitor-native");
      document.body.classList.remove("capacitor-native");
    };
  }, [router]);

  useEffect(() => {
    if (!isCapacitorNative()) return;

    let cancelled = false;

    void (async () => {
      const res = await fetch("/api/profile");
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { emailVerified?: boolean };
      if (!data.emailVerified || cancelled) return;
      await registerCapacitorPush();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
