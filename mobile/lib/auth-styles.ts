import { StyleSheet } from "react-native";

export const zinc = {
  light: {
    background: "#fafafa",
    surface: "#ffffff",
    text: "#18181b",
    muted: "#71717a",
    border: "#e4e4e7",
    primary: "#18181b",
    primaryText: "#fafafa",
    error: "#dc2626",
    link: "#52525b",
  },
  dark: {
    background: "#09090b",
    surface: "#18181b",
    text: "#fafafa",
    muted: "#a1a1aa",
    border: "#3f3f46",
    primary: "#fafafa",
    primaryText: "#18181b",
    error: "#f87171",
    link: "#a1a1aa",
  },
};

export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  googleButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
  },
  footer: {
    marginTop: 20,
    fontSize: 14,
    textAlign: "center",
  },
  link: {
    textDecorationLine: "underline",
    fontWeight: "500",
  },
  error: {
    fontSize: 14,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: "center",
  },
});
