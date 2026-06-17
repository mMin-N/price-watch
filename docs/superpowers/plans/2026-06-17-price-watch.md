# Price Watch MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-user price tracking web app where users add product URLs, prices are fetched via ZenRows, history is stored append-only, and target-price alerts fire in-app + via email.

**Architecture:** Next.js monolith (App Router + API Routes) with Supabase Auth/PostgreSQL and RLS. All scraping behind `PriceProvider.fetchPrice()`. Shared `runPricePipeline()` for add/refresh/cron. Vercel hosts app + cron; Resend sends email.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Supabase (`@supabase/ssr`), ZenRows API, Resend, Vitest, recharts

**Spec:** `docs/superpowers/specs/2026-06-17-price-watch-design.md`

---

## File Map

| Path | Responsibility |
|------|----------------|
| `middleware.ts` | Supabase session refresh; protect dashboard routes |
| `lib/supabase/client.ts` | Browser Supabase client |
| `lib/supabase/server.ts` | Server Component / API Supabase client |
| `lib/supabase/admin.ts` | Service-role client for cron |
| `lib/supabase/middleware.ts` | Session helper for middleware |
| `lib/providers/price-provider.ts` | `PriceProvider` interface |
| `lib/providers/zenrows.ts` | ZenRows implementation |
| `lib/pipeline/run-price-pipeline.ts` | 6-step pipeline |
| `lib/pipeline/evaluate-alert.ts` | Pure alert evaluation (testable) |
| `lib/email/send-alert.ts` | Resend wrapper |
| `lib/api/auth.ts` | `requireUser()` helper for API routes |
| `lib/api/errors.ts` | JSON error responses |
| `supabase/migrations/001_initial.sql` | Tables, RLS, profile trigger |
| `app/api/**` | REST endpoints |
| `app/(auth)/**` | Login / register |
| `app/(dashboard)/**` | Protected pages |
| `components/**` | Shared UI |
| `vercel.json` | Cron schedule |

---

### Task 1: Scaffold Next.js project

**Files:**
- Create: project root via `create-next-app`
- Create: `.env.local.example`
- Modify: `package.json` (add vitest, deps)

- [ ] **Step 1: Initialize Next.js in repo root**

Run from `c:\___myworkspace2\price watch`:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

Expected: `package.json`, `app/layout.tsx`, `app/page.tsx` created.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr resend recharts
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create `.env.local.example`**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ZENROWS_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=alerts@yourdomain.com
CRON_SECRET=
```

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: `Ready` on `http://localhost:3000`

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js project with vitest"
```

---

### Task 2: Database migration

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Write migration SQL**

Create `supabase/migrations/001_initial.sql` with full schema from spec (profiles, wishlist_items, tracked_products, price_history, notifications, alert_logs), indexes, RLS policies, and profile trigger:

```sql
-- profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- wishlist_items
create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- tracked_products
create table tracked_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wishlist_item_id uuid references wishlist_items(id) on delete set null,
  url text not null,
  title text,
  target_price numeric,
  currency text default 'USD',
  last_price numeric,
  last_fetched_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, url)
);

-- price_history
create table price_history (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  price numeric not null,
  currency text not null default 'USD',
  provider text not null default 'zenrows',
  created_at timestamptz default now()
);
create index idx_price_history_product_time on price_history (tracked_product_id, created_at desc);

-- notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracked_product_id uuid references tracked_products(id) on delete set null,
  type text not null default 'price_alert',
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index idx_notifications_user_unread on notifications (user_id, created_at desc) where read_at is null;

-- alert_logs
create table alert_logs (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  price_history_id uuid not null references price_history(id),
  triggered_price numeric not null,
  target_price numeric not null,
  email_sent boolean default false,
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table wishlist_items enable row level security;
alter table tracked_products enable row level security;
alter table price_history enable row level security;
alter table notifications enable row level security;
alter table alert_logs enable row level security;

create policy "profiles_select_own" on profiles for select using (id = auth.uid());
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

create policy "wishlists_all_own" on wishlist_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "products_all_own" on tracked_products for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "price_history_select_own" on price_history for select using (
  exists (select 1 from tracked_products tp where tp.id = price_history.tracked_product_id and tp.user_id = auth.uid())
);
create policy "price_history_insert_own" on price_history for insert with check (
  exists (select 1 from tracked_products tp where tp.id = price_history.tracked_product_id and tp.user_id = auth.uid())
);

create policy "notifications_all_own" on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "alert_logs_select_own" on alert_logs for select using (
  exists (select 1 from tracked_products tp where tp.id = alert_logs.tracked_product_id and tp.user_id = auth.uid())
);
```

- [ ] **Step 2: Apply migration in Supabase**

Supabase Dashboard → SQL Editor → paste and run `001_initial.sql`.

Expected: all tables visible in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_initial.sql
git commit -m "feat: add initial database schema and RLS"
```

---

### Task 3: Supabase clients and middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`
- Modify: `app/layout.tsx` (metadata title)

- [ ] **Step 1: Browser client**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Server client**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — middleware handles refresh
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Admin client (cron)**

Create `lib/supabase/admin.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
```

- [ ] **Step 4: Middleware session helper**

Create `lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { supabaseResponse, user };
}
```

- [ ] **Step 5: Root middleware**

Create `middleware.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (PUBLIC_PATHS.includes(path) && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (!PUBLIC_PATHS.includes(path) && !path.startsWith("/api/cron") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 6: Commit**

```bash
git add lib/supabase middleware.ts
git commit -m "feat: add Supabase clients and auth middleware"
```

---

### Task 4: Auth pages (login / register)

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Modify: `app/page.tsx` → move to `app/(dashboard)/page.tsx` later in Task 12

- [ ] **Step 1: Login page**

Create `app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto mt-20 max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        No account? <Link href="/register" className="underline">Register</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Register page**

Create `app/(auth)/register/page.tsx` (same pattern, `signUp` instead of `signInWithPassword`).

- [ ] **Step 3: Manual test**

1. `npm run dev`
2. Visit `/register`, create account
3. Confirm redirect to `/` and `profiles` row in Supabase

- [ ] **Step 4: Commit**

```bash
git add app/(auth)
git commit -m "feat: add login and register pages"
```

---

### Task 5: Price provider interface and ZenRows

**Files:**
- Create: `lib/providers/price-provider.ts`
- Create: `lib/providers/zenrows.ts`
- Create: `lib/providers/parse-price.ts`
- Create: `lib/providers/parse-price.test.ts`

- [ ] **Step 1: Write failing test for price parsing**

Create `lib/providers/parse-price.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parsePriceFromHtml } from "./parse-price";

describe("parsePriceFromHtml", () => {
  it("extracts price from meta og:price:amount", () => {
    const html = '<meta property="og:price:amount" content="29.99" />';
    expect(parsePriceFromHtml(html)).toEqual({ price: 29.99, currency: "USD" });
  });

  it("extracts price from dollar text", () => {
    const html = '<span class="price">$19.50</span>';
    expect(parsePriceFromHtml(html)).toEqual({ price: 19.5, currency: "USD" });
  });

  it("returns null when no price found", () => {
    expect(parsePriceFromHtml("<html></html>")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- lib/providers/parse-price.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement parser and interface**

Create `lib/providers/price-provider.ts`:

```typescript
export interface PriceFetchResult {
  price: number;
  currency: string;
}

export interface PriceProvider {
  fetchPrice(url: string): Promise<PriceFetchResult>;
}
```

Create `lib/providers/parse-price.ts`:

```typescript
import type { PriceFetchResult } from "./price-provider";

export function parsePriceFromHtml(html: string): PriceFetchResult | null {
  const ogMatch = html.match(/property="og:price:amount"\s+content="([\d.]+)"/i)
    ?? html.match(/content="([\d.]+)"\s+property="og:price:amount"/i);
  if (ogMatch) {
    return { price: parseFloat(ogMatch[1]), currency: "USD" };
  }
  const dollarMatch = html.match(/\$\s*([\d,]+\.?\d*)/);
  if (dollarMatch) {
    return { price: parseFloat(dollarMatch[1].replace(/,/g, "")), currency: "USD" };
  }
  return null;
}
```

Create `lib/providers/zenrows.ts`:

```typescript
import type { PriceProvider, PriceFetchResult } from "./price-provider";
import { parsePriceFromHtml } from "./parse-price";

export class ZenRowsProvider implements PriceProvider {
  async fetchPrice(url: string): Promise<PriceFetchResult> {
    const apiKey = process.env.ZENROWS_API_KEY;
    if (!apiKey) throw new Error("ZENROWS_API_KEY not configured");

    const params = new URLSearchParams({
      apikey: apiKey,
      url,
      js_render: "true",
    });
    const start = Date.now();
    const res = await fetch(`https://api.zenrows.com/v1/?${params}`);
    const durationMs = Date.now() - start;

    if (!res.ok) {
      console.error(JSON.stringify({ step: "fetch", url, status: res.status, durationMs }));
      throw new Error(`ZenRows request failed: ${res.status}`);
    }

    const html = await res.text();
    const parsed = parsePriceFromHtml(html);
    console.log(JSON.stringify({ step: "provider_response", url, durationMs, parsed: !!parsed }));

    if (!parsed) {
      throw new Error("Cannot parse price from page");
    }
    return parsed;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- lib/providers/parse-price.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/providers
git commit -m "feat: add PriceProvider interface and ZenRows implementation"
```

---

### Task 6: Alert evaluation and price pipeline

**Files:**
- Create: `lib/pipeline/evaluate-alert.ts`
- Create: `lib/pipeline/evaluate-alert.test.ts`
- Create: `lib/pipeline/run-price-pipeline.ts`

- [ ] **Step 1: Write failing alert evaluation tests**

Create `lib/pipeline/evaluate-alert.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { shouldTriggerAlert } from "./evaluate-alert";

describe("shouldTriggerAlert", () => {
  it("returns false when target is null", () => {
    expect(shouldTriggerAlert(10, null)).toBe(false);
  });

  it("returns true when price <= target", () => {
    expect(shouldTriggerAlert(9.99, 10)).toBe(true);
    expect(shouldTriggerAlert(10, 10)).toBe(true);
  });

  it("returns false when price > target", () => {
    expect(shouldTriggerAlert(10.01, 10)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- lib/pipeline/evaluate-alert.test.ts
```

- [ ] **Step 3: Implement evaluate-alert**

Create `lib/pipeline/evaluate-alert.ts`:

```typescript
export function shouldTriggerAlert(price: number, targetPrice: number | null): boolean {
  if (targetPrice === null) return false;
  return price <= targetPrice;
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Implement pipeline**

Create `lib/pipeline/run-price-pipeline.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriceProvider } from "@/lib/providers/price-provider";
import { shouldTriggerAlert } from "./evaluate-alert";
import { sendPriceAlertEmail } from "@/lib/email/send-alert";

export async function runPricePipeline(
  supabase: SupabaseClient,
  trackedProductId: string,
  provider: PriceProvider
) {
  const correlationId = `${trackedProductId}-${Date.now()}`;

  const { data: product, error: loadError } = await supabase
    .from("tracked_products")
    .select("id, user_id, url, target_price, title")
    .eq("id", trackedProductId)
    .single();

  if (loadError || !product) throw new Error("Tracked product not found");
  console.log(JSON.stringify({ step: "input", correlationId, url: product.url, userId: product.user_id }));

  const { price, currency } = await provider.fetchPrice(product.url);

  const { data: history, error: historyError } = await supabase
    .from("price_history")
    .insert({
      tracked_product_id: product.id,
      price,
      currency,
      provider: "zenrows",
    })
    .select("id")
    .single();

  if (historyError || !history) throw new Error("Failed to insert price history");
  console.log(JSON.stringify({ step: "db_write", correlationId, priceHistoryId: history.id, success: true }));

  await supabase
    .from("tracked_products")
    .update({ last_price: price, last_fetched_at: new Date().toISOString(), currency })
    .eq("id", product.id);

  const triggered = shouldTriggerAlert(price, product.target_price);
  console.log(JSON.stringify({
    step: "alert_eval",
    correlationId,
    targetPrice: product.target_price,
    currentPrice: price,
    triggered,
  }));

  if (!triggered) return { price, currency, alerted: false };

  const { data: existingAlert } = await supabase
    .from("alert_logs")
    .select("id")
    .eq("price_history_id", history.id)
    .maybeSingle();

  if (existingAlert) return { price, currency, alerted: false };

  const message = `Price dropped to ${currency} ${price} (target: ${product.target_price})`;
  const { data: notification } = await supabase
    .from("notifications")
    .insert({
      user_id: product.user_id,
      tracked_product_id: product.id,
      message,
    })
    .select("id")
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", product.user_id)
    .single();

  let emailSent = false;
  if (profile?.email) {
    emailSent = await sendPriceAlertEmail({
      to: profile.email,
      productTitle: product.title ?? product.url,
      url: product.url,
      price,
      targetPrice: product.target_price!,
      currency,
    });
  }

  await supabase.from("alert_logs").insert({
    tracked_product_id: product.id,
    price_history_id: history.id,
    triggered_price: price,
    target_price: product.target_price!,
    email_sent: emailSent,
  });

  console.log(JSON.stringify({ step: "notify", correlationId, notificationId: notification?.id, emailSent }));

  return { price, currency, alerted: true };
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/pipeline
git commit -m "feat: add alert evaluation and price pipeline"
```

---

### Task 7: Email helper

**Files:**
- Create: `lib/email/send-alert.ts`

- [ ] **Step 1: Implement Resend wrapper**

Create `lib/email/send-alert.ts`:

```typescript
import { Resend } from "resend";

interface SendPriceAlertParams {
  to: string;
  productTitle: string;
  url: string;
  price: number;
  targetPrice: number;
  currency: string;
}

export async function sendPriceAlertEmail(params: SendPriceAlertParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("Resend not configured; skipping email");
    return false;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: `[Price Watch] Target price reached: ${params.productTitle}`,
    text: `Good news! ${params.productTitle} is now ${params.currency} ${params.price} (your target: ${params.currency} ${params.targetPrice}).\n\nView: ${params.url}`,
  });

  if (error) {
    console.error(JSON.stringify({ step: "email_error", message: error.message }));
    return false;
  }
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/email
git commit -m "feat: add Resend price alert email helper"
```

---

### Task 8: API helpers and wishlists routes

**Files:**
- Create: `lib/api/auth.ts`
- Create: `lib/api/errors.ts`
- Create: `app/api/wishlists/route.ts`
- Create: `app/api/wishlists/[id]/route.ts`

- [ ] **Step 1: API helpers**

Create `lib/api/auth.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "./errors";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, response: jsonError(401, "Unauthorized") };
  return { supabase, user, response: null };
}
```

Create `lib/api/errors.ts`:

```typescript
import { NextResponse } from "next/server";

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}
```

- [ ] **Step 2: GET/POST wishlists**

Create `app/api/wishlists/route.ts` with `GET` (list with product counts via Supabase select) and `POST` (`{ name }`).

- [ ] **Step 3: PATCH/DELETE wishlist by id**

Create `app/api/wishlists/[id]/route.ts`. DELETE sets `tracked_products.wishlist_item_id = null` for affected rows before deleting wishlist.

- [ ] **Step 4: Manual test with curl or REST client (logged in via browser cookie)**

- [ ] **Step 5: Commit**

```bash
git add lib/api app/api/wishlists
git commit -m "feat: add wishlists API routes"
```

---

### Task 9: Products API and refresh

**Files:**
- Create: `app/api/products/route.ts`
- Create: `app/api/products/[id]/route.ts`
- Create: `app/api/products/[id]/refresh/route.ts`

- [ ] **Step 1: GET/POST products**

`POST /api/products` body: `{ url, targetPrice?, wishlistItemId? }`
- Validate URL with `new URL(url)`
- Check duplicate → 409
- Insert `tracked_products`
- Call `runPricePipeline(supabase, id, new ZenRowsProvider())`
- Return product with latest price

- [ ] **Step 2: GET/PATCH/DELETE product by id**

`PATCH` accepts `{ targetPrice?, wishlistItemId? }` — no pipeline run.

- [ ] **Step 3: POST refresh with cooldown**

Create `app/api/products/[id]/refresh/route.ts`:

```typescript
const COOLDOWN_MS = 15 * 60 * 1000;

// If last_fetched_at within COOLDOWN_MS → 429 with retryAfterSeconds
// Else runPricePipeline(...)
```

- [ ] **Step 4: Manual test — add Amazon/product URL, verify price_history row**

- [ ] **Step 5: Commit**

```bash
git add app/api/products
git commit -m "feat: add products API with pipeline on create and refresh"
```

---

### Task 10: Notifications API

**Files:**
- Create: `app/api/notifications/route.ts`
- Create: `app/api/notifications/[id]/read/route.ts`
- Create: `app/api/notifications/read-all/route.ts`

- [ ] **Step 1: GET notifications**

Query param `unreadOnly=true` optional. Order by `created_at desc`.

- [ ] **Step 2: PATCH mark read / POST read-all**

- [ ] **Step 3: Commit**

```bash
git add app/api/notifications
git commit -m "feat: add notifications API"
```

---

### Task 11: Cron endpoint

**Files:**
- Create: `app/api/cron/refresh-prices/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Cron route**

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { ZenRowsProvider } from "@/lib/providers/zenrows";
import { runPricePipeline } from "@/lib/pipeline/run-price-pipeline";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: products } = await supabase
    .from("tracked_products")
    .select("id, last_fetched_at")
    .or(`last_fetched_at.is.null,last_fetched_at.lt.${sixHoursAgo}`)
    .limit(20);

  const provider = new ZenRowsProvider();
  let succeeded = 0;
  let failed = 0;

  for (const p of products ?? []) {
    try {
      await runPricePipeline(supabase, p.id, provider);
      succeeded++;
    } catch {
      failed++;
    }
  }

  return Response.json({
    processed: products?.length ?? 0,
    succeeded,
    failed,
    skipped: 0,
  });
}
```

- [ ] **Step 2: vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-prices",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

- [ ] **Step 3: Local test**

```bash
curl -X POST http://localhost:3000/api/cron/refresh-prices -H "Authorization: Bearer YOUR_CRON_SECRET"
```

- [ ] **Step 4: Commit**

```bash
git add app/api/cron vercel.json
git commit -m "feat: add scheduled price refresh cron endpoint"
```

---

### Task 12: Dashboard layout and navigation

**Files:**
- Create: `app/(dashboard)/layout.tsx`
- Create: `components/dashboard-nav.tsx`
- Create: `components/notification-bell.tsx`
- Move: `app/page.tsx` → `app/(dashboard)/page.tsx` (placeholder)

- [ ] **Step 1: Dashboard layout with nav links**

Nav: Dashboard `/`, Wishlists `/wishlists`, Notifications `/notifications` with unread count from `GET /api/notifications?unreadOnly=true`.

- [ ] **Step 2: Sign out button**

Call `supabase.auth.signOut()` then redirect `/login`.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard) components
git commit -m "feat: add dashboard layout and navigation"
```

---

### Task 13: Dashboard page and product components

**Files:**
- Create: `components/add-product-form.tsx`
- Create: `components/product-list.tsx`
- Modify: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Add product form**

Client component: URL, optional target price, optional wishlist dropdown → `POST /api/products`.

- [ ] **Step 2: Product list**

Show url/title, last_price, target_price, last_fetched_at, refresh button (handle 429 cooldown message), delete, link to detail. Highlight row when `last_price <= target_price`.

- [ ] **Step 3: Wire dashboard page**

Load products via server fetch or client `GET /api/products` on mount.

- [ ] **Step 4: Commit**

```bash
git add components app/(dashboard)/page.tsx
git commit -m "feat: add dashboard with add-product form and product list"
```

---

### Task 14: Wishlist pages

**Files:**
- Create: `app/(dashboard)/wishlists/page.tsx`
- Create: `app/(dashboard)/wishlists/[id]/page.tsx`

- [ ] **Step 1: Wishlists list page — CRUD groups**

- [ ] **Step 2: Group detail — filtered product list reusing `ProductList`**

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/wishlists
git commit -m "feat: add wishlist management pages"
```

---

### Task 15: Product detail page with price chart

**Files:**
- Create: `app/(dashboard)/products/[id]/page.tsx`
- Create: `components/price-chart.tsx`

- [ ] **Step 1: Detail page**

Fetch `GET /api/products/[id]`. Show URL, editable target price (`PATCH`), refresh button, price history table.

- [ ] **Step 2: recharts line chart**

`components/price-chart.tsx` maps `price_history` to `{ date, price }`.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/products components/price-chart.tsx
git commit -m "feat: add product detail page with price history chart"
```

---

### Task 16: Notifications page

**Files:**
- Create: `app/(dashboard)/notifications/page.tsx`

- [ ] **Step 1: List notifications with mark read / mark all**

- [ ] **Step 2: Link each notification to `/products/[id]` when `tracked_product_id` present**

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/notifications
git commit -m "feat: add notifications page"
```

---

### Task 17: Manual E2E verification

**Files:**
- None (verification only)

- [ ] **Step 1: Register new user**

- [ ] **Step 2: Add product URL with target price above current price**

- [ ] **Step 3: Confirm price appears on dashboard and in `price_history`**

- [ ] **Step 4: Set target price >= current price (or use mock provider locally) — confirm notification + email**

- [ ] **Step 5: Manual refresh — confirm 429 within 15 minutes**

- [ ] **Step 6: Hit cron endpoint — confirm batch processing**

- [ ] **Step 7: Walk success criteria in spec — all checked**

---

## Spec Coverage Check

| Spec section | Task(s) |
|--------------|---------|
| 3-layer architecture | Tasks 1, 5, 9, 11 |
| Data model + RLS | Task 2 |
| Supabase Auth | Tasks 3, 4 |
| `fetchPrice` abstraction | Task 5 |
| 6-step pipeline | Task 6 |
| In-app + email alerts | Tasks 6, 7, 10 |
| Cron 6h + manual 15min cooldown | Tasks 9, 11 |
| All API endpoints | Tasks 8–11 |
| Frontend pages | Tasks 12–16 |
| Logging | Tasks 5, 6 |
| Deployment env + vercel cron | Tasks 1, 11 |
| Success criteria | Task 17 |

## Self-Review Notes

- All tasks map to spec requirements; no TBD placeholders.
- `shouldTriggerAlert`, `parsePriceFromHtml`, and pipeline signatures are consistent across tasks.
- Cron uses admin client; user routes use RLS-scoped client.
- shadcn/ui can be added during Task 12+ if desired; plain Tailwind is sufficient for MVP per YAGNI.
