import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { apiFetch } from "@/lib/api-client";
import { authStyles, zinc } from "./auth-styles";
import { supabase } from "@/lib/supabase";

type ProfileResponse = {
  email?: string;
  emailVerified?: boolean;
};

export default function VerifyEmailScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/profile");
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/(auth)/login");
          return;
        }
        setError("Could not load profile");
        return;
      }
      const data = (await res.json()) as ProfileResponse;
      if (data.email) setEmail(data.email);
      if (data.emailVerified) {
        router.replace("/(tabs)");
        return;
      }
    } catch {
      setError("Could not load profile");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void checkProfile();
  }, [checkProfile]);

  async function handleResend() {
    const targetEmail =
      email ??
      (await supabase.auth.getSession()).data.session?.user.email ??
      null;
    if (!targetEmail) {
      setError("No email address found");
      return;
    }
    setResending(true);
    setError(null);
    setMessage(null);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
    });
    setResending(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setMessage("Verification email sent. Check your inbox.");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  if (loading) {
    return (
      <View style={[authStyles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <View style={[authStyles.container, { backgroundColor: colors.background }]}>
      <View style={authStyles.card}>
        <Text style={[authStyles.title, { color: colors.text }]}>
          Verify your email
        </Text>
        <Text style={[authStyles.message, { color: colors.muted }]}>
          {email
            ? `We sent a confirmation link to ${email}. Open it to unlock Price Watch.`
            : "Please confirm your email address to continue."}
        </Text>

        {message ? (
          <Text style={[authStyles.message, { color: colors.text }]}>{message}</Text>
        ) : null}
        {error ? (
          <Text style={[authStyles.error, { color: colors.error }]}>{error}</Text>
        ) : null}

        <Pressable
          onPress={handleResend}
          disabled={resending}
          style={[
            authStyles.button,
            { backgroundColor: colors.primary },
            resending && { opacity: 0.6 },
          ]}
        >
          {resending ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[authStyles.buttonText, { color: colors.primaryText }]}>
              Resend verification email
            </Text>
          )}
        </Pressable>

        <Pressable onPress={handleSignOut} style={[authStyles.button, { marginTop: 12 }]}>
          <Text style={[authStyles.buttonText, { color: colors.muted }]}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
