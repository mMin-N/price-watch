import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { zinc } from "@/app/(auth)/auth-styles";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.text, { color: colors.muted }]}>Coming soon</Text>
      {id ? (
        <Text style={[styles.id, { color: colors.muted }]}>Product {id}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  text: {
    fontSize: 16,
  },
  id: {
    fontSize: 13,
    marginTop: 8,
  },
});
