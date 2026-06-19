# Android App v1 — Design Spec

**Date:** 2026-06-19  
**Status:** Approved (brainstorming)  
**Parent:** `docs/superpowers/specs/2026-06-17-price-watch-design.md`  
**Skill:** `.cursor/skills/price-watch-mvp/SKILL.md`

## Summary

Ship **Price Watch Android v1** as an Expo (React Native) app: mobile dashboard for tracked products, wishlists, in-app notifications, and **FCM push** for price alerts. Reuse the existing Next.js REST API with **Bearer token** auth. **v2** (out of scope for v1) adds shopping-companion Share Intent + client-side price extraction, mirroring the Chrome extension.

## Decisions (brainstorming)

| Item | Decision |
|------|----------|
| Product vision | Management app now + shopping companion in v2 |
| Release phasing | **v1** dashboard; **v2** Share Intent / WebView scrape |
| Client tech | **Expo / React Native** (Android-first) |
| Architecture | **Approach 1:** API-first + Bearer auth (not Supabase-direct, not Capacitor) |
| Push | **FCM in v1** alongside existing email alerts |
| Platform | Android only for v1; no iOS build |
| Price refresh | Cron only (manual refresh API remains disabled) |

## Goals (v1)

- Android users can register/login (email + Google), verify email, and manage tracked products.
- Feature parity with web dashboard core flows: list, add (preview), detail, alerts, wishlists, notifications.
- Price alert triggers deliver **FCM push** to registered devices in addition to email.
- Backend changes stay within the existing 3-layer monolith; no new microservices.

## Non-Goals (v1)

- iOS build or App Store submission.
- Share Intent, WebView price extraction, or extension-style `POST /api/price-update` from mobile.
- Offline mode or local SQLite cache.
- Manual per-product refresh (disabled on web/API).
- Stripe billing, display-currency picker, Web Push.
- Rewriting business logic in the mobile client (all mutations via REST API).

---

## 1. Architecture

```
mobile/ (Expo app, Android v1)
    │  Supabase Auth → session in SecureStore
    │  REST calls with Authorization: Bearer <access_token>
    ▼
Next.js API routes (existing + Bearer auth + device register)
    │
    ├──► Supabase PostgreSQL (tracked_products, notifications, device_tokens, …)
    │
    └──► PriceProvider → ZenRows (preview/add only; unchanged pipeline)

Alert pipeline (persist-price-snapshot.ts):
    insert notifications → send email (existing) → send FCM (new)
```

### New backend modules

| Module | Location | Purpose |
|--------|----------|---------|
| Bearer-aware auth | `lib/api/auth.ts` | `requireUserFromRequest(request)` — Cookie or Bearer |
| Device tokens | `supabase/migrations/010_device_tokens.sql` | Store FCM tokens per user |
| Device API | `app/api/devices/register/route.ts` | Register/update/delete FCM token |
| FCM sender | `lib/push/send-fcm-alert.ts` | Firebase Admin SDK; prune dead tokens |

### Mobile project layout

```
mobile/
  app/                    # expo-router screens
  components/
  lib/
    api-client.ts         # fetch wrapper + Bearer + 401 refresh
    supabase.ts           # Auth + expo-secure-store adapter
  app.json                # Android package, scheme, plugins
  eas.json                # EAS Build profiles
```

Use **Expo Dev Client** (not Expo Go) for FCM native support via `expo-notifications`.

---

## 2. Authentication

### Mobile login

- **Email/password:** `supabase.auth.signInWithPassword`
- **Google:** `supabase.auth.signInWithOAuth({ provider: 'google' })` → system browser / Custom Tabs → deep link `price-watch://auth/callback` (or Expo scheme)
- **Session storage:** `@supabase/supabase-js` with `expo-secure-store` adapter; `autoRefreshToken: true`

### API authentication

All user-facing API routes switch from `requireUser()` to `requireUserFromRequest(request)`:

1. If `Authorization: Bearer <jwt>` → create Supabase client with global header; `getUser()`
2. Else → existing cookie-based `createClient()` from `lib/supabase/server.ts`

Pattern already exists in `lib/api/extension-auth.ts`; consolidate into shared auth helper to avoid duplication.

### Middleware change

`middleware.ts` currently returns 401 for all `/api/*` without cookie session. Update:

- If request has `Authorization: Bearer …` header → **skip** middleware 401; let route handler validate token.
- Cron and public routes unchanged.

### Email verification gate

Same as web: `requireVerifiedUser` for `POST /api/products` and `POST /api/products/preview`. Unverified users see a dedicated screen with resend-verification action (`supabase.auth.resend`).

---

## 3. v1 Feature Scope

| Screen / flow | API endpoints |
|---------------|---------------|
| Product list (pull-to-refresh) | `GET /api/products` |
| Add product (URL → preview → confirm) | `POST /api/products/preview`, `POST /api/products` |
| Product detail (history chart, edit alerts, delete) | `GET/PATCH/DELETE /api/products/[id]` |
| Wishlists list + create | `GET/POST /api/wishlists` |
| Wishlist detail | `GET /api/wishlists/[id]` |
| Notifications + mark read | `GET /api/notifications`, `PATCH /api/notifications/[id]/read`, `POST /api/notifications/read-all` |
| Profile / settings | `GET /api/profile` |
| FCM token register | `POST /api/devices/register` (new) |
| FCM token unregister (logout) | `DELETE /api/devices/register` (new) |

### UI routes (expo-router)

| Route | Purpose |
|-------|---------|
| `(auth)/login` | Email + Google sign-in |
| `(auth)/register` | Sign up |
| `(auth)/verify-email` | Blocked state until verified |
| `(tabs)/index` | Product list |
| `(tabs)/wishlists` | Wishlist list |
| `(tabs)/notifications` | Notification center |
| `products/[id]` | Detail + chart + alert settings |
| `products/add` | URL input → preview → add |
| `settings` | Email, notification permission, legal links, logout |

Visual style: native RN components; zinc palette aligned with web; price chart via `react-native-gifted-charts` or `victory-native` (pick one at implementation).

---

## 4. FCM Push

### Schema (`010_device_tokens.sql`)

```sql
CREATE TABLE public.device_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token  text NOT NULL,
  platform   text NOT NULL DEFAULT 'android',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fcm_token)
);

CREATE INDEX idx_device_tokens_user ON public.device_tokens (user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_tokens_own" ON public.device_tokens
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

Service-role client used for FCM send (bypasses RLS); user-facing register API uses authenticated user context.

### Register API

```
POST /api/devices/register
{ "fcmToken": "string", "platform": "android" }

DELETE /api/devices/register
{ "fcmToken": "string" }
```

Upsert on `(user_id, fcm_token)`; update `updated_at` on conflict.

### Send pipeline

In `lib/pipeline/persist-price-snapshot.ts`, after notification insert and email send:

1. Load `device_tokens` for `product.user_id` (service role).
2. For each token, `sendFcmAlert({ token, title, body, data: { productId, notificationId } })`.
3. On Firebase `messaging/registration-token-not-registered` (or equivalent), delete token row.
4. FCM failure is logged only; does not fail the pipeline or block email.

### Mobile FCM flow

1. On login success, request notification permission.
2. `expo-notifications` → get device push token.
3. `POST /api/devices/register`.
4. Notification tap → deep link to `products/[productId]`.
5. On logout → `DELETE /api/devices/register` then `signOut`.

### Environment variables (backend)

| Variable | Purpose |
|----------|---------|
| `FIREBASE_PROJECT_ID` | Firebase Admin |
| `FIREBASE_CLIENT_EMAIL` | Service account |
| `FIREBASE_PRIVATE_KEY` | Service account key (escaped newlines) |

### Mobile Firebase setup

- Create Firebase Android app; package name matches `app.json` `android.package`.
- Place `google-services.json` in `mobile/`.
- Configure `expo-notifications` plugin in `app.json`.

---

## 5. Error Handling

| Condition | Mobile behavior |
|-----------|-----------------|
| Network error | Toast + retry affordance |
| 401 | Refresh session once; on failure → login |
| 403 unverified | Navigate to verify-email screen |
| 429 rate limit | Show rate-limit message from API |
| Preview fetch failure | Show site name + error (match web) |
| Tracking limit reached | Show `MAX_TRACKED_PRODUCTS_PER_USER` message |
| FCM permission denied | App works; in-app notifications only; settings shows re-enable hint |

---

## 6. Testing

### Backend (Vitest)

- `requireUserFromRequest`: valid Bearer, valid Cookie, missing auth, expired token
- `POST/DELETE /api/devices/register`: upsert, ownership, delete
- `send-fcm-alert`: mock Firebase Admin; verify payload shape; token pruning on invalid token

### Mobile

- Unit: `api-client` attaches Bearer header; handles 401 refresh path
- Manual E2E: login → add Amazon URL → list shows product → edit target price → trigger test alert → receive push → tap opens detail

### Release

- EAS Build → AAB for Google Play Internal Testing
- Settings links to existing `/privacy` and `/terms` on production web URL

---

## 7. v2 Preview (not implemented in v1)

| Item | Direction |
|------|-----------|
| Share Intent | `expo-share-intent` or native module for `ACTION_SEND` from Amazon/Flipkart apps |
| Price extraction | WebView + inject logic from `lib/extension/parse-dom-price.ts` |
| Backend | Extend `POST /api/price-update` site check beyond Amazon |
| Auth | Reuse Bearer token (same as extension) |

---

## 8. Environment Variables

### Backend (add to `.env.local.example`)

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

### Mobile (`mobile/.env.example`)

```
EXPO_PUBLIC_API_URL=https://your-app.vercel.app
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Success Criteria (v1)

- [ ] Android app installs via Play Internal Testing (or dev build).
- [ ] User can log in with email or Google and pass email verification gate.
- [ ] User can add a product URL, see it in the list, open detail with price history.
- [ ] User can create wishlists and assign products (same as web).
- [ ] In-app notifications list matches web notifications for the same account.
- [ ] When a price alert fires, user receives FCM push on Android (and email still works).
- [ ] Logout clears FCM registration for that device.
