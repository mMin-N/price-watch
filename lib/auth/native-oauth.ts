import { createClient } from "@/lib/supabase/client";
import { NATIVE_OAUTH_REDIRECT } from "@/lib/capacitor";

function extractSessionFromUrl(
  url: string
): { access_token: string; refresh_token: string } | null {
  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");

  let paramString = "";
  if (hashIndex !== -1) {
    paramString = url.substring(hashIndex + 1);
  } else if (queryIndex !== -1) {
    paramString = url.substring(queryIndex + 1);
  }

  if (!paramString) return null;

  const params = new URLSearchParams(paramString);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (access_token && refresh_token) {
    return { access_token, refresh_token };
  }
  return null;
}

async function exchangeCodeFromUrl(url: string): Promise<string | null> {
  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  if (!code) return null;

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error?.message ?? null;
}

/**
 * Handle OAuth return URL opened via custom scheme (Capacitor App plugin).
 */
export async function handleNativeOAuthCallback(url: string): Promise<string | null> {
  if (!url.startsWith(NATIVE_OAUTH_REDIRECT.split("?")[0]!)) {
    return null;
  }

  const tokens = extractSessionFromUrl(url);
  if (tokens) {
    const supabase = createClient();
    const { error } = await supabase.auth.setSession(tokens);
    return error?.message ?? null;
  }

  return exchangeCodeFromUrl(url);
}

/**
 * Google sign-in via system browser; completion handled by registerNativeOAuthListener.
 */
export async function signInWithGoogleNative(): Promise<string | null> {
  const { Browser } = await import("@capacitor/browser");

  const supabase = createClient();
  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: NATIVE_OAUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });

  if (oauthError) return oauthError.message;
  if (!data.url) return "Could not start Google sign-in";

  await Browser.open({ url: data.url, presentationStyle: "popover" });
  return null;
}

let oauthListenerRegistered = false;

/** Register global deep-link handler for OAuth returns. */
export async function registerNativeOAuthListener(
  onSuccess: () => void
): Promise<() => void> {
  if (oauthListenerRegistered) {
    return () => undefined;
  }

  const { App } = await import("@capacitor/app");
  const { Browser } = await import("@capacitor/browser");
  oauthListenerRegistered = true;

  const sub = await App.addListener("appUrlOpen", async (event) => {
    const authError = await handleNativeOAuthCallback(event.url);
    if (authError) return;

    await Browser.close().catch(() => undefined);
    onSuccess();
  });

  return () => {
    oauthListenerRegistered = false;
    void sub.remove();
  };
}
