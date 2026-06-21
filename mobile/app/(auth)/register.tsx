import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { authStyles, zinc } from "@/lib/auth-styles";
import { supabase } from "@/lib/supabase";

export default function RegisterScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.replace("/(auth)/verify-email");
      return;
    }
    Alert.alert(
      "Check your email",
      "We sent a verification link. Sign in after confirming your email.",
      [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
    );
  }

  return (
    <KeyboardAvoidingView
      style={[authStyles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={authStyles.card}>
        <Text style={[authStyles.title, { color: colors.text }]}>Register</Text>

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
          autoComplete="new-password"
        />

        {error ? (
          <Text style={[authStyles.error, { color: colors.error }]}>{error}</Text>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={[
            authStyles.button,
            { backgroundColor: colors.primary },
            loading && { opacity: 0.6 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[authStyles.buttonText, { color: colors.primaryText }]}>
              Create account
            </Text>
          )}
        </Pressable>

        <Text style={[authStyles.footer, { color: colors.muted }]}>
          Already have an account?{" "}
          <Link href="/(auth)/login" style={[authStyles.link, { color: colors.link }]}>
            Login
          </Link>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
