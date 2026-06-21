import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, ThemeProvider, Redirect, Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import { ToastHost } from "@/components/toast-host";
import { apiFetch } from "@/lib/api-client";
import {
  registerForPushNotifications,
  setupNotificationResponseListener,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

export {
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

type AuthState = {
  session: Session | null;
  emailVerified: boolean | null;
  isLoading: boolean;
};

async function fetchEmailVerified(): Promise<boolean> {
  const res = await apiFetch("/api/profile");
  if (!res.ok) return false;
  const data = (await res.json()) as { emailVerified?: boolean };
  return Boolean(data.emailVerified);
}

function useAuthState(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function syncFromSession(nextSession: Session | null) {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession) {
        setEmailVerified(null);
        setIsLoading(false);
        return;
      }
      const verified = await fetchEmailVerified();
      if (!mounted) return;
      setEmailVerified(verified);
      setIsLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      void syncFromSession(initial);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setIsLoading(true);
      void syncFromSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, emailVerified, isLoading };
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, emailVerified, isLoading } = useAuthState();
  const segments = useSegments();
  const router = useRouter();
  const segmentList = segments as string[];
  const inAuthGroup = segmentList[0] === "(auth)";
  const onVerifyEmail = segmentList.includes("verify-email");

  useEffect(() => {
    if (isLoading) return;

    if (!session) {
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
      return;
    }

    if (emailVerified === false) {
      if (!onVerifyEmail) {
        router.replace("/(auth)/verify-email");
      }
      return;
    }

    if (emailVerified === true && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, emailVerified, isLoading, inAuthGroup, onVerifyEmail, router]);

  if (isLoading) return null;

  if (!session && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }
  if (session && emailVerified === false && !onVerifyEmail) {
    return <Redirect href="/(auth)/verify-email" />;
  }
  if (session && emailVerified === true && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <PushNotificationsSetup
        session={session}
        emailVerified={emailVerified}
        isLoading={isLoading}
      />
      <ToastHost />
      {children}
    </>
  );
}

function PushNotificationsSetup({
  session,
  emailVerified,
  isLoading,
}: {
  session: Session | null;
  emailVerified: boolean | null;
  isLoading: boolean;
}) {
  const router = useRouter();
  const isAuthenticated = !isLoading && !!session && emailVerified === true;

  useEffect(() => {
    if (!isAuthenticated) return;
    void registerForPushNotifications();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    return setupNotificationResponseListener(router);
  }, [isAuthenticated, router]);

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="products" options={{ headerShown: false }} />
          <Stack.Screen name="wishlists" options={{ headerShown: false }} />
          <Stack.Screen
            name="settings"
            options={{
              title: "Settings",
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>
      </AuthGate>
    </ThemeProvider>
  );
}
