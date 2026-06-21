# Price Watch Mobile (Android v1)

> **New:** Android is moving to a **Capacitor web shell** in [`capacitor-app/`](../capacitor-app/README.md).  
> The Expo app below is legacy; use Capacitor for new Android work.

Expo app for Price Watch Android v1. Uses a **dev client** (not Expo Go) for FCM push and native modules.

## Prerequisites

- **Node.js** 18+ and npm
- **Android Studio** with Android SDK, platform tools, and at least one emulator or a USB-connected device with USB debugging enabled
- **EAS CLI** for cloud builds: `npm install -g eas-cli` then `eas login`
- **Expo account** linked to the project (`eas init` if not already configured)

## Environment setup

1. Copy the example env file:

```bash
cd mobile
cp .env.example .env
```

2. Fill in `.env`:

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Production or local Next.js API base URL (e.g. `https://your-app.vercel.app`) |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

`.env` is gitignored. Never commit secrets.

## Local development

Install dependencies:

```bash
cd mobile
npm install
```

**Native dev client** (required for FCM and full Android behavior):

```bash
npx expo run:android
```

**Metro only** (JS changes without rebuilding native code):

```bash
npx expo start
```

Then press `a` to open on a connected emulator/device that already has the dev client installed.

## Firebase / Push Notifications (Android)

FCM requires a Firebase Android app whose package name matches `com.pricewatch.app` in `app.json`.

1. In [Firebase Console](https://console.firebase.google.com/), create or open your project and add an Android app with package name `com.pricewatch.app`.
2. Download `google-services.json` from Firebase.
3. Place the file at `mobile/google-services.json`.

This file is **not committed** to git (see root `.gitignore`). Each developer and CI build environment must add it locally.

4. Rebuild the native app after adding the file:

```bash
cd mobile
npx expo run:android
```

Push token registration (`registerForPushNotifications`) only works on physical devices with a valid Firebase configuration.

## Supabase: Google OAuth redirect URL

Google sign-in uses the app scheme `price-watch` (see `app.json` and `app/(auth)/login.tsx`).

In the [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **URL Configuration**, add this redirect URL:

```
price-watch://
```

Also ensure Google OAuth is enabled under **Authentication** → **Providers** → **Google**, with the same Google Cloud OAuth client used by the web app.

Without this redirect URL, Google sign-in completes in the browser but cannot return the session to the app.

## EAS Build (internal testing AAB)

`eas.json` defines `preview` (internal distribution) and `production` profiles. Both produce an **Android App Bundle** (`.aab`).

**Preview** — internal testing (Play Console internal track or direct install via EAS):

```bash
cd mobile
eas build --platform android --profile preview
```

**Production** — Play Store release candidate:

```bash
cd mobile
eas build --platform android --profile production
```

Before the first build:

1. Add `google-services.json` locally (or configure EAS secrets / file upload for CI).
2. Run `eas credentials` if signing keys are not yet set up.

Download the `.aab` from the EAS build page and upload to Google Play Console (internal testing or production track).

## TypeScript check

```bash
cd mobile
npx tsc --noEmit
```
