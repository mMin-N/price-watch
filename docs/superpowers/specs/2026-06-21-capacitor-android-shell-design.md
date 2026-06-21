# Capacitor Android Shell — Design Spec

**Date:** 2026-06-21  
**Status:** Implemented (phase 1)  
**Replaces:** Expo dev client workflow in `mobile/` for Android v1

## Summary

Wrap the deployed Next.js Price Watch web app in a **Capacitor Android shell** (`capacitor-app/`). The shell loads the remote HTTPS site; native plugins handle **FCM push** and **Google OAuth** (system browser + deep link). Web UI gains **mobile bottom navigation** and **Profile push settings**.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| `capacitor-app/` | Android APK, WebView, FCM native, deep link intent |
| `app/` (Next.js) | All product UI, API calls, Capacitor JS bridge |
| Existing `/api/*` | Unchanged; `device_tokens` + FCM send reused |

## Key decisions

| Item | Decision |
|------|----------|
| Content delivery | Remote URL (`server.url`), not static export |
| Package ID | `com.pricewatch.app` (same as Expo) |
| OAuth redirect | `com.pricewatch.app://auth/callback` |
| Push | `@capacitor/push-notifications` → `POST /api/devices/register` |
| Mobile nav | Bottom tabs on `md` breakpoint and below |
| Expo `mobile/` | Deprecated after shell validation |

## Web changes

- `lib/capacitor.ts` — native detection, push token storage
- `lib/auth/native-oauth.ts` — Browser + App deep link OAuth
- `lib/push/capacitor-push.ts` — FCM register / tap navigation
- `components/capacitor-bridge.tsx` — mount in root layout
- `components/mobile-bottom-nav.tsx` — Products / Lists / Alerts / Profile
- `components/google-auth-button.tsx` — native vs web OAuth split
- `app/(dashboard)/profile/page.tsx` — push permission UI

## Console configuration

1. **Supabase** — add redirect URL `com.pricewatch.app://auth/callback`
2. **Firebase** — Android app `com.pricewatch.app`, download `google-services.json`
3. **Vercel** — set `NEXT_PUBLIC_APP_URL` to production URL

## Non-goals (this phase)

- iOS Capacitor shell
- Removing `mobile/` directory (manual deprecation)
- Offline support
- Web Push in browser (native FCM only)
