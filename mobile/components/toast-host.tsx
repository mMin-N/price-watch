import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { registerToastListener } from "@/lib/toast";
import { zinc } from "@/lib/auth-styles";

type ActiveToast = {
  id: number;
  message: string;
  variant: "success" | "error";
};

export function ToastHost() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const [toast, setToast] = useState<ActiveToast | null>(null);

  useEffect(() => {
    registerToastListener((message, variant) => {
      const id = Date.now();
      setToast({ id, message, variant });
      setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, 3200);
    });

    return () => registerToastListener(null);
  }, []);

  if (!toast) return null;

  const isError = toast.variant === "error";

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      style={[
        styles.host,
        {
          backgroundColor: isError
            ? colorScheme === "dark"
              ? "#450a0a"
              : "#fef2f2"
            : colorScheme === "dark"
              ? "#052e16"
              : "#ecfdf5",
          borderColor: isError
            ? colorScheme === "dark"
              ? "#7f1d1d"
              : "#fecaca"
            : colorScheme === "dark"
              ? "#14532d"
              : "#a7f3d0",
        },
      ]}
      pointerEvents="none"
    >
      <Text
        style={{
          color: isError
            ? colorScheme === "dark"
              ? "#fecaca"
              : "#991b1b"
            : colorScheme === "dark"
              ? "#bbf7d0"
              : "#065f46",
          fontSize: 14,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 32,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 1000,
    elevation: 8,
  },
});
