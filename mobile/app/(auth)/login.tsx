import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { authStyles, zinc } from "./auth-styles";

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
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = "price-watch://";

export default function LoginScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: REDIRECT_URI,
          skipBrowserRedirect: true,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        return;
      }
      if (!data.url) {
        setError("Could not start Google sign-in");
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        REDIRECT_URI
      );
      if (result.type !== "success" || !result.url) return;

      const tokens = extractSessionFromUrl(result.url);
      if (!tokens) {
        setError("Could not complete Google sign-in");
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession(tokens);
      if (sessionError) {
        setError(sessionError.message);
      }
    } catch {
      setError("Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  const busy = loading || googleLoading;

  return (
    <KeyboardAvoidingView
      style={[authStyles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={authStyles.card}>
        <Text style={[authStyles.title, { color: colors.text }]}>Login</Text>

        <Pressable
          onPress={handleGoogleSignIn}
          disabled={busy}
          style={[
            authStyles.googleButton,
            { borderColor: colors.border, backgroundColor: colors.surface },
            busy && { opacity: 0.6 },
          ]}
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={[authStyles.googleButtonText, { color: colors.text }]}>
              Continue with Google
            </Text>
          )}
        </Pressable>

        <View style={authStyles.dividerRow}>
          <View style={[authStyles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[authStyles.dividerText, { color: colors.muted }]}>or</Text>
          <View style={[authStyles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <TextInput
          style={[
            authStyles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={[
            authStyles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {error ? (
          <Text style={[authStyles.error, { color: colors.error }]}>{error}</Text>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={busy}
          style={[
            authStyles.button,
            { backgroundColor: colors.primary },
            busy && { opacity: 0.6 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[authStyles.buttonText, { color: colors.primaryText }]}>
              Sign in
            </Text>
          )}
        </Pressable>

        <Text style={[authStyles.footer, { color: colors.muted }]}>
          No account?{" "}
          <Link href="/(auth)/register" style={[authStyles.link, { color: colors.link }]}>
            Register
          </Link>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
