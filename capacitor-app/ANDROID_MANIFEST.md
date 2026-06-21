# After `npx cap add android` or `npx cap sync`, ensure AndroidManifest.xml includes:

## OAuth deep link (inside MainActivity)

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="com.pricewatch.app"
        android:host="auth"
        android:pathPrefix="/callback" />
</intent-filter>
```

## Push (Android 13+)

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Capacitor may regenerate manifest on sync — re-apply if OAuth stops working.
