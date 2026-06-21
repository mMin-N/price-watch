import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { zinc } from "@/lib/auth-styles";

type SummaryBarProps = {
  priceDropCount: number;
  unreadCount: number;
};

export function SummaryBar({ priceDropCount, unreadCount }: SummaryBarProps) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];

  if (priceDropCount === 0 && unreadCount === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {priceDropCount > 0 ? (
        <Text style={[styles.text, { color: colors.text }]}>
          {priceDropCount} price drop{priceDropCount === 1 ? "" : "s"}
        </Text>
      ) : null}
      {priceDropCount > 0 && unreadCount > 0 ? (
        <Text style={[styles.dot, { color: colors.muted }]}>·</Text>
      ) : null}
      {unreadCount > 0 ? (
        <Pressable onPress={() => router.push("/(tabs)/notifications")}>
          <Text style={[styles.link, { color: colors.link }]}>
            {unreadCount} unread
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
  },
  dot: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: "600",
  },
});
