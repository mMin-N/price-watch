# Price Watch Mobile

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

Or use EAS Build for preview/production builds. Push token registration (`registerForPushNotifications`) only works on physical devices with a valid Firebase configuration.
