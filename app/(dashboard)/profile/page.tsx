"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isCapacitorNative, getStoredPushToken } from "@/lib/capacitor";
import { HowTrackingWorks } from "@/components/how-tracking-works";
import {
  getPushPermissionState,
  pushPermissionLabel,
  registerCapacitorPush,
  unregisterCapacitorPush,
  type PushPermissionState,
} from "@/lib/push/capacitor-push";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [pushPermission, setPushPermission] = useState<PushPermissionState>("unsupported");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enablingPush, setEnablingPush] = useState(false);
  const nativeApp = isCapacitorNative();

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, permission] = await Promise.all([
        fetch("/api/profile"),
        nativeApp ? getPushPermissionState() : Promise.resolve("unsupported" as const),
      ]);

      if (!profileRes.ok) {
        const data = (await profileRes.json()) as { error?: string };
        setError(data.error ?? "Failed to load profile");
        return;
      }

      const data = (await profileRes.json()) as {
        email?: string;
        emailVerified?: boolean;
      };
      setEmail(data.email ?? null);
      setEmailVerified(data.emailVerified ?? false);
      setPushPermission(permission);
    } catch {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [nativeApp]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleEnablePush() {
    setEnablingPush(true);
    try {
      await registerCapacitorPush();
      setPushPermission(await getPushPermissionState());
    } finally {
      setEnablingPush(false);
    }
  }

  async function handleSignOut() {
    const token = getStoredPushToken();
    if (token) {
      await unregisterCapacitorPush();
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        {!nativeApp ? (
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to dashboard
          </Link>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Profile</h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</h2>
            <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">{email ?? "—"}</p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Verification
            </h2>
            <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
              {emailVerified ? "Verified" : "Not verified — check your inbox"}
            </p>
          </div>
          {nativeApp ? (
            <div>
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Push notifications
              </h2>
              <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                {pushPermissionLabel(pushPermission)}
              </p>
              {pushPermission !== "granted" ? (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={enablingPush || pushPermission === "denied"}
                  className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {enablingPush ? "Enabling…" : "Enable notifications"}
                </button>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          How tracking works
        </h2>
        <HowTrackingWorks />
      </section>

      {nativeApp ? (
        <nav className="flex justify-center gap-4 text-xs text-zinc-500">
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
