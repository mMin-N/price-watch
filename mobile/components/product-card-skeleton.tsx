import { StyleSheet, View } from "react-native";

import { useColorScheme } from "@/components/useColorScheme";
import { zinc } from "@/lib/auth-styles";

function ProductCardSkeletonItem() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = zinc[colorScheme];
  const block = colorScheme === "dark" ? "#27272a" : "#e4e4e7";
  const blockMuted = colorScheme === "dark" ? "#18181b" : "#f4f4f5";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.titleBlock, { backgroundColor: block }]} />
        <View style={[styles.priceBlock, { backgroundColor: block }]} />
      </View>
      <View style={[styles.metaBlock, { backgroundColor: blockMuted }]} />
      <View style={styles.footerRow}>
        <View style={[styles.footerBlock, { backgroundColor: blockMuted }]} />
        <View style={[styles.footerBlockSmall, { backgroundColor: blockMuted }]} />
      </View>
    </View>
  );
}

export function ProductCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeletonItem key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    height: 40,
    borderRadius: 6,
  },
  priceBlock: {
    width: 72,
    height: 28,
    borderRadius: 6,
  },
  metaBlock: {
    marginTop: 10,
    height: 14,
    width: "55%",
    borderRadius: 4,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  footerBlock: {
    width: 64,
    height: 10,
    borderRadius: 4,
  },
  footerBlockSmall: {
    width: 40,
    height: 10,
    borderRadius: 4,
  },
});
