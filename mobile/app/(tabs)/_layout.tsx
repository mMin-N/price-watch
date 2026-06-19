import { SymbolView } from "expo-symbols";
import { Tabs, useRouter } from "expo-router";
import { Pressable } from "react-native";

import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { zinc } from "@/app/(auth)/auth-styles";

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Products",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "tag.fill",
                android: "sell",
                web: "sell",
              }}
              tintColor={color}
              size={26}
            />
          ),
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/products/add")}
              style={{ marginRight: 15 }}
              accessibilityLabel="Add product"
            >
              {({ pressed }) => (
                <SymbolView
                  name={{ ios: "plus", android: "add", web: "add" }}
                  size={25}
                  tintColor={colors.text}
                  style={{ opacity: pressed ? 0.5 : 1 }}
                />
              )}
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="wishlists"
        options={{
          title: "Wishlists",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "heart.fill",
                android: "favorite",
                web: "favorite",
              }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
    </Tabs>
  );
}
