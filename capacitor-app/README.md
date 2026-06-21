# Price Watch — Capacitor Android Shell

Android app that loads the **deployed Next.js web app** in a WebView. No Metro / Expo dev client required for daily iteration: deploy the website and the shell picks up changes automatically.

## Architecture

```
capacitor-app (Android shell)
  └── WebView → NEXT_PUBLIC_APP_URL (e.g. https://your-app.vercel.app)
        └── Next.js app (app/) with CapacitorBridge, mobile bottom nav, native OAuth + FCM
```

The legacy Expo app in `mobile/` can be retired once this shell is validated.

## Prerequisites

- Node.js 18+
- Android Studio + SDK + Platform-Tools
- Deployed Next.js site on HTTPS
- Firebase project with Android app `com.pricewatch.app`
- `google-services.json` from Firebase Console

## One-time setup

### 1. Configure server URL

Set your production URL in `.env.local` at the repo root:

```env
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

For Capacitor sync, export before adding Android:

```bash
# cmd
set CAPACITOR_SERVER_URL=https://your-app.vercel.app

# PowerShell
$env:CAPACITOR_SERVER_URL="https://your-app.vercel.app"
```

### 2. Supabase OAuth redirect

In Supabase Dashboard → **Authentication** → **URL Configuration**, add:

```
com.pricewatch.app://auth/callback
```

### 3. Install and generate Android project

```bash
cd capacitor-app
npm install
npx cap add android
```

### 4. Firebase (push notifications)

1. Copy `google-services.json` to `capacitor-app/android/app/google-services.json`
2. In `capacitor-app/android/build.gradle`, ensure buildscript has:

   ```gradle
   classpath 'com.google.gms:google-services:4.4.4'
   ```

3. At the bottom of `capacitor-app/android/app/build.gradle`:

   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

4. Sync:

   ```bash
   npx cap sync android
   ```

## Daily development

| Task | Command |
|------|---------|
| Change UI / logic | Edit `app/`, deploy to Vercel |
| Rebuild shell (icons, native plugins) | `cd capacitor-app && npx cap sync android` |
| Run on USB device | Android Studio → Run, or `npx cap run android` |

Web changes do **not** require rebuilding the APK when using remote `server.url` mode.

## Local web testing in shell (optional)

Point the shell at your LAN dev server (email login works; Google OAuth needs HTTPS):

```bash
set CAPACITOR_SERVER_URL=http://192.168.1.100:3000
npx cap sync android
```

## Build release AAB

1. Android Studio → **Build → Generate Signed Bundle / APK**
2. Upload `.aab` to Google Play Console

## Package name

`com.pricewatch.app` — matches Firebase and the legacy Expo app.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank / placeholder page | Set `CAPACITOR_SERVER_URL` and run `npx cap sync android` |
| Google sign-in fails | Add `com.pricewatch.app://auth/callback` in Supabase; use system browser flow (automatic in app) |
| No push | Add `google-services.json`, apply GMS plugin, grant notification permission in Profile |
| Web page not available | Ensure phone has network; URL must be HTTPS in production |
