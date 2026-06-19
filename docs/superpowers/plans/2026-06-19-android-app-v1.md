# Android App v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Android v1 (Expo) with dashboard, wishlists, notifications, and FCM push; backend gains Bearer auth and device token storage.

**Architecture:** Expo app calls existing Next.js REST API with `Authorization: Bearer`; Supabase Auth on mobile with SecureStore; FCM sent from `persist-price-snapshot` via Firebase Admin SDK.

**Tech Stack:** Expo SDK 52+, expo-router, @supabase/supabase-js, expo-secure-store, expo-notifications, firebase-admin (backend), Vitest

**Spec:** `docs/superpowers/specs/2026-06-19-android-app-v1-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/api/auth.ts` | Add `requireUserFromRequest`, shared Bearer client factory |
| `lib/api/auth.test.ts` | Bearer auth unit tests |
| `middleware.ts` | Skip cookie 401 when Bearer present |
| `supabase/migrations/010_device_tokens.sql` | FCM token table + RLS |
| `app/api/devices/register/route.ts` | Register/delete FCM tokens |
| `lib/push/send-fcm-alert.ts` | Firebase Admin send + invalid token handling |
| `lib/push/send-fcm-alert.test.ts` | Mocked FCM tests |
| `lib/pipeline/persist-price-snapshot.ts` | Call FCM after notification insert |
| `.env.local.example` | Firebase env vars |
| `mobile/` | Entire Expo app |

---

### Task 1: Bearer-aware API auth

**Files:**
- Modify: `lib/api/auth.ts`
- Modify: `lib/api/extension-auth.ts` (reuse shared helper)
- Test: `lib/api/auth.test.ts`

- [ ] **Step 1: Write failing test for bearer token extraction**

Add to `lib/api/auth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { bearerTokenFromRequest } from "./auth";

describe("bearerTokenFromRequest", () => {
  it("returns token from Authorization header", () => {
    const req = new Request("https://x/api/products", {
      headers: { Authorization: "Bearer abc123" },
    });
    expect(bearerTokenFromRequest(req)).toBe("abc123");
  });

  it("returns null when header missing", () => {
    const req = new Request("https://x/api/products");
    expect(bearerTokenFromRequest(req)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/api/auth.test.ts`
Expected: FAIL — `bearerTokenFromRequest` not exported

- [ ] **Step 3: Implement shared Bearer helpers in `lib/api/auth.ts`**

```typescript
export function bearerTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export function createSupabaseClientForBearer(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function requireUserFromRequest(request?: Request) {
  const bearer = request ? bearerTokenFromRequest(request) : null;
  if (bearer) {
    const supabase = createSupabaseClientForBearer(bearer);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { supabase: null, user: null, response: jsonError(401, "Unauthorized") };
    }
    return { supabase, user, response: null };
  }
  return requireUser();
}

export async function requireVerifiedUserFromRequest(request?: Request) {
  const result = await requireUserFromRequest(request);
  if (result.response) return result;
  if (!isEmailVerified(result.user!)) {
    return {
      ...result,
      response: jsonError(403, "Please verify your email before using price tracking features"),
    };
  }
  return result;
}
```

Refactor `lib/api/extension-auth.ts` to call `bearerTokenFromRequest` + `createSupabaseClientForBearer` instead of duplicating.

- [ ] **Step 4: Run tests**

Run: `npm test -- lib/api/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/api/auth.ts lib/api/auth.test.ts lib/api/extension-auth.ts
git commit -m "feat(api): add Bearer token auth for mobile clients"
```

---

### Task 2: Wire API routes to `requireUserFromRequest`

**Files:**
- Modify: all routes under `app/api/` that call `requireUser` or `requireVerifiedUser` (except cron)
- Modify: `middleware.ts`

- [ ] **Step 1: Update middleware to allow Bearer through**

In `middleware.ts`, before the `isUserApi` 401 block:

```typescript
function hasBearerAuth(request: NextRequest): boolean {
  const header = request.headers.get("authorization");
  return Boolean(header?.startsWith("Bearer "));
}
```

Change the user API check to:

```typescript
if (isUserApi(path) && !user && !isExtensionIngestApi(path) && !hasBearerAuth(request)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

- [ ] **Step 2: Update each user API route**

Replace `requireUser()` → `requireUserFromRequest(request)` and `requireVerifiedUser()` → `requireVerifiedUserFromRequest(request)`, passing the route `request` object.

Files to update:
- `app/api/products/route.ts`
- `app/api/products/[id]/route.ts`
- `app/api/products/preview/route.ts`
- `app/api/wishlists/route.ts`
- `app/api/wishlists/[id]/route.ts`
- `app/api/notifications/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/notifications/read-all/route.ts`
- `app/api/profile/route.ts`
- `app/api/extension/token/route.ts`

Example change in `app/api/products/route.ts`:

```typescript
export async function GET(request: Request) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response) return response;
  // ...
}
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add middleware.ts app/api/
git commit -m "feat(api): accept Bearer auth on all user API routes"
```

---

### Task 3: Device tokens migration

**Files:**
- Create: `supabase/migrations/010_device_tokens.sql`

- [ ] **Step 1: Add migration file**

Copy SQL from spec §4 into `supabase/migrations/010_device_tokens.sql` (table, index, RLS policy `device_tokens_own`).

- [ ] **Step 2: Apply locally (if dev DB available)**

Run: `npm run db:catchup` or apply migration via Supabase CLI.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_device_tokens.sql
git commit -m "feat(db): add device_tokens table for FCM"
```

---

### Task 4: Device register API

**Files:**
- Create: `app/api/devices/register/route.ts`

- [ ] **Step 1: Implement POST and DELETE**

```typescript
import { NextResponse } from "next/server";
import { requireUserFromRequest } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response || !supabase || !user) return response ?? jsonError(401, "Unauthorized");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const fcmToken = body.fcmToken;
  const platform = body.platform ?? "android";
  if (typeof fcmToken !== "string" || !fcmToken.trim()) {
    return jsonError(400, "fcmToken is required");
  }
  if (typeof platform !== "string") {
    return jsonError(400, "platform must be a string");
  }

  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: user.id,
      fcm_token: fcmToken.trim(),
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,fcm_token" }
  );

  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response || !supabase || !user) return response ?? jsonError(401, "Unauthorized");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const fcmToken = body.fcmToken;
  if (typeof fcmToken !== "string" || !fcmToken.trim()) {
    return jsonError(400, "fcmToken is required");
  }

  const { error } = await supabase
    .from("device_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("fcm_token", fcmToken.trim());

  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Manual smoke test with curl + extension Bearer token**

```bash
curl -X POST http://localhost:3000/api/devices/register \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"fcmToken":"test-token","platform":"android"}'
```

Expected: `{"ok":true}`

- [ ] **Step 3: Commit**

```bash
git add app/api/devices/register/route.ts
git commit -m "feat(api): register and unregister FCM device tokens"
```

---

### Task 5: FCM send module + pipeline hook

**Files:**
- Create: `lib/push/send-fcm-alert.ts`
- Create: `lib/push/send-fcm-alert.test.ts`
- Modify: `lib/pipeline/persist-price-snapshot.ts`
- Modify: `.env.local.example`
- Modify: `package.json` (add `firebase-admin`)

- [ ] **Step 1: Install firebase-admin**

Run: `npm install firebase-admin`

- [ ] **Step 2: Write failing test**

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("firebase-admin", () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    messaging: () => ({
      send: vi.fn().mockResolvedValue("msg-id"),
    }),
  },
}));

import { sendFcmAlert } from "./send-fcm-alert";

describe("sendFcmAlert", () => {
  it("returns false when Firebase not configured", async () => {
    const result = await sendFcmAlert({
      token: "t",
      title: "Alert",
      body: "Price dropped",
      data: { productId: "p1" },
    });
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 3: Implement `lib/push/send-fcm-alert.ts`**

Lazy-init Firebase Admin when env vars present; `sendFcmAlert` returns boolean; export `sendFcmAlertsToUser(supabase, userId, payload)` that loads tokens with service role and sends to all.

Use `createClient` with `SUPABASE_SERVICE_ROLE_KEY` for token fetch in pipeline context (or pass tokens from caller).

- [ ] **Step 4: Hook into `persist-price-snapshot.ts`**

After notification insert (and parallel to email), call:

```typescript
await sendFcmAlertsToUser(supabase, product.user_id, {
  title: `[Price Watch] ${subjectReason}`,
  body: message,
  data: { productId: product.id, notificationId: notification.id },
});
```

- [ ] **Step 5: Add env vars to `.env.local.example`**

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

- [ ] **Step 6: Run tests**

Run: `npm test -- lib/push/send-fcm-alert.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/push/ lib/pipeline/persist-price-snapshot.ts package.json package-lock.json .env.local.example
git commit -m "feat(push): send FCM alerts when price alert triggers"
```

---

### Task 6: Scaffold Expo mobile app

**Files:**
- Create: `mobile/` (Expo project)

- [ ] **Step 1: Create Expo app in `mobile/`**

Run from repo root:

```bash
npx create-expo-app@latest mobile --template tabs
```

- [ ] **Step 2: Add dependencies**

```bash
cd mobile
npx expo install @supabase/supabase-js expo-secure-store expo-notifications expo-device expo-constants expo-linking expo-web-browser
npm install react-native-gifted-charts react-native-svg
```

- [ ] **Step 3: Configure `mobile/app.json`**

Set `android.package` (e.g. `com.pricewatch.app`), `scheme: "price-watch"`, add `expo-notifications` plugin with icon/color.

- [ ] **Step 4: Add `mobile/.env.example` and `mobile/eas.json`**

Document `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 5: Add root `.gitignore` entries if needed**

```
mobile/.env
mobile/google-services.json
```

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): scaffold Expo app for Android v1"
```

---

### Task 7: Mobile Supabase auth + API client

**Files:**
- Create: `mobile/lib/supabase.ts`
- Create: `mobile/lib/api-client.ts`

- [ ] **Step 1: Implement SecureStore Supabase client**

```typescript
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);
```

- [ ] **Step 2: Implement `api-client.ts`**

```typescript
import { supabase } from "./supabase";

const API_BASE = process.env.EXPO_PUBLIC_API_URL!;

export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed?.access_token) {
      headers.set("Authorization", `Bearer ${refreshed.access_token}`);
      return fetch(`${API_BASE}${path}`, { ...init, headers });
    }
  }

  return res;
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/
git commit -m "feat(mobile): Supabase auth and API client with Bearer tokens"
```

---

### Task 8: Auth screens + session gate

**Files:**
- Create/modify: `mobile/app/(auth)/login.tsx`, `register.tsx`, `verify-email.tsx`
- Modify: `mobile/app/_layout.tsx` — auth redirect logic

- [ ] **Step 1: Build login screen** — email/password fields, Google button calling `signInWithOAuth` + `WebBrowser.openAuthSessionAsync` with redirect to app scheme.

- [ ] **Step 2: Build register screen** — `signUp` + navigate to verify-email.

- [ ] **Step 3: Build verify-email screen** — call `GET /api/profile`; if `emailVerified` false, show resend button.

- [ ] **Step 4: Root layout auth gate**

On app load, `supabase.auth.getSession()`:
- no session → `(auth)/login`
- session + unverified (profile API) → `(auth)/verify-email`
- verified → `(tabs)`

- [ ] **Step 5: Commit**

```bash
git add mobile/app/
git commit -m "feat(mobile): auth screens and session routing"
```

---

### Task 9: Product list tab

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`
- Create: `mobile/components/product-card.tsx`

- [ ] **Step 1: Fetch and display products**

`apiFetch('/api/products')` → map to `ProductCard` list with site badge, last price, alert active indicator.

- [ ] **Step 2: Pull-to-refresh** with `RefreshControl`.

- [ ] **Step 3: FAB or header button → `products/add`.**

- [ ] **Step 4: Tap card → `products/[id]`.**

- [ ] **Step 5: Commit**

```bash
git add mobile/app/(tabs)/index.tsx mobile/components/product-card.tsx
git commit -m "feat(mobile): product list with pull-to-refresh"
```

---

### Task 10: Add product flow

**Files:**
- Create: `mobile/app/products/add.tsx`

- [ ] **Step 1: URL TextInput + Preview button** → `POST /api/products/preview` with `{ url }`.

- [ ] **Step 2: Show preview** (title, price, siteName) + Confirm → `POST /api/products`.

- [ ] **Step 3: Handle errors** (429, 403, fetch failure messages).

- [ ] **Step 4: On success** → navigate to product detail or list.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/products/add.tsx
git commit -m "feat(mobile): add product with URL preview"
```

---

### Task 11: Product detail screen

**Files:**
- Create: `mobile/app/products/[id].tsx`

- [ ] **Step 1: Load** `GET /api/products/[id]` — show title, URL, current price, availability, site badge.

- [ ] **Step 2: Price history chart** from `priceHistory` array (gifted-charts line chart).

- [ ] **Step 3: Edit target price / discount alert** → `PATCH /api/products/[id]`.

- [ ] **Step 4: Delete** with confirmation → `DELETE /api/products/[id]` → go back.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/products/[id].tsx
git commit -m "feat(mobile): product detail with chart and alert settings"
```

---

### Task 12: Wishlists tab

**Files:**
- Modify: `mobile/app/(tabs)/wishlists.tsx`
- Create: `mobile/app/wishlists/[id].tsx`

- [ ] **Step 1: List wishlists** — `GET /api/wishlists`, show name + product count.

- [ ] **Step 2: Create wishlist** — modal with name → `POST /api/wishlists`.

- [ ] **Step 3: Wishlist detail** — `GET /api/wishlists/[id]`, list products, tap → product detail.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/(tabs)/wishlists.tsx mobile/app/wishlists/
git commit -m "feat(mobile): wishlists list and detail"
```

---

### Task 13: Notifications tab

**Files:**
- Modify: `mobile/app/(tabs)/notifications.tsx`

- [ ] **Step 1: List** `GET /api/notifications`.

- [ ] **Step 2: Tap to mark read** — `PATCH /api/notifications/[id]/read`.

- [ ] **Step 3: Mark all read** — `POST /api/notifications/read-all`.

- [ ] **Step 4: Tap notification** → navigate to `products/[trackedProductId]` when present.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/(tabs)/notifications.tsx
git commit -m "feat(mobile): in-app notification center"
```

---

### Task 14: FCM on mobile

**Files:**
- Create: `mobile/lib/notifications.ts`
- Modify: `mobile/app/_layout.tsx`
- Create: `mobile/app/settings.tsx`

- [ ] **Step 1: Implement `registerForPushNotifications()`**

Request permission → `Notifications.getDevicePushTokenAsync()` → `POST /api/devices/register`.

- [ ] **Step 2: Call on login** in auth success handler.

- [ ] **Step 3: Notification response listener** — parse `data.productId` → `router.push(/products/${id})`.

- [ ] **Step 4: Logout flow** — `DELETE /api/devices/register` then `supabase.auth.signOut`.

- [ ] **Step 5: Settings screen** — show permission status, link to `/privacy` and `/terms` on web, logout button.

- [ ] **Step 6: Add `google-services.json` locally** (not committed); document in `mobile/README.md`.

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/notifications.ts mobile/app/settings.tsx mobile/README.md
git commit -m "feat(mobile): FCM registration and notification deep links"
```

---

### Task 15: EAS Build + README

**Files:**
- Create: `mobile/README.md`
- Modify: `mobile/eas.json`

- [ ] **Step 1: Document dev setup** — env vars, `npx expo run:android`, Firebase setup steps.

- [ ] **Step 2: Configure EAS** `preview` and `production` profiles for AAB.

- [ ] **Step 3: Run TypeScript check**

```bash
cd mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add mobile/README.md mobile/eas.json
git commit -m "docs(mobile): Android build and Firebase setup guide"
```

---

## Plan self-review

| Spec requirement | Task |
|------------------|------|
| Bearer API auth | Task 1–2 |
| FCM device tokens + API | Task 3–4 |
| FCM send on alert | Task 5 |
| Expo scaffold | Task 6 |
| Auth (email + Google) | Task 7–8 |
| Product list/add/detail | Task 9–11 |
| Wishlists | Task 12 |
| Notifications | Task 13 |
| FCM mobile + settings | Task 14 |
| Play build docs | Task 15 |
| v2 Share Intent | Explicitly excluded |

No TBD placeholders remain in task steps.
