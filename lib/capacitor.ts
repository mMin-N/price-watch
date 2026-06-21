import { Capacitor } from "@capacitor/core";

/** Custom URL scheme for native OAuth redirect (must match Supabase allow list). */
export const NATIVE_OAUTH_REDIRECT =
  process.env.NEXT_PUBLIC_NATIVE_OAUTH_REDIRECT ?? "com.pricewatch.app://auth/callback";

const PUSH_TOKEN_STORAGE_KEY = "pw_fcm_push_token";

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

export function getStoredPushToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredPushToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore quota errors
  }
}

export function clearStoredPushToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export { PUSH_TOKEN_STORAGE_KEY };
