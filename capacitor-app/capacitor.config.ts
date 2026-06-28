import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Remote URL mode: the shell loads your deployed Next.js app.
 * Set CAPACITOR_SERVER_URL before `npx cap sync` for local/dev overrides.
 *
 * Examples:
 *   Production: https://your-app.vercel.app
 *   Local LAN:  http://192.168.1.100:3000  (HTTPS recommended for OAuth)
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://your-app.vercel.app";

const config: CapacitorConfig = {
  appId: "com.dropt.com",
  appName: "Dropt",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    intentFilters: [
      {
        action: "VIEW",
        category: ["DEFAULT", "BROWSABLE"],
        data: {
          scheme: "com.dropt.com",
          host: "auth",
          pathPrefix: "/callback",
        },
      },
    ],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
