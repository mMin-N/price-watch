import { Stack } from "expo-router";

import { useColorScheme } from "@/components/useColorScheme";
import { zinc } from "@/lib/auth-styles";

export default function ProductsLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="add" options={{ title: "Add Product" }} />
      <Stack.Screen name="[id]" options={{ title: "Product" }} />
    </Stack>
  );
}
