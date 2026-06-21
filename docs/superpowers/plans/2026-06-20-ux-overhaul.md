# UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship unified Mobile + Web UX with glanceable product cards, humanized data, flow parity, and smart defaults (`Other` wishlist) in three phases (P1 Foundation → P2 Flow parity → P3 Polish).

**Architecture:** Extend `mapProduct()` with computed display fields; shared formatter logic (`lib/format/display.ts` + mobile mirror); Web table → `ProductCard`; Mobile aligns to same data model and sort. P2 adds migration `011_default_wishlist.sql` and `ensureDefaultWishlist`. All business logic stays in API layer.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, Expo SDK 56, expo-router, Vitest

**Spec:** `docs/superpowers/specs/2026-06-20-ux-overhaul-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/format/display.ts` | `formatRelativeTime`, `formatPriceChange`, `formatDistanceToTarget` |
| `lib/format/display.test.ts` | Formatter unit tests |
| `lib/api/product-map.ts` | Add computed fields to `mapProduct` |
| `lib/api/product-map.test.ts` | Computed field tests |
| `lib/products/sort-products.ts` | Urgency sort for product lists |
| `lib/products/sort-products.test.ts` | Sort order tests |
| `lib/types/product.ts` | Extended `Product` type |
| `components/product-card.tsx` | Web unified ProductCard |
| `components/product-list.tsx` | Replace table with card grid |
| `components/dashboard-content.tsx` | Apply sort, remove cron footer |
| `mobile/lib/format-display.ts` | Mobile copy of formatters |
| `mobile/components/product-card.tsx` | Upgraded card (L1–L4 hierarchy) |
| `mobile/app/(tabs)/index.tsx` | Sort products client-side |
| `supabase/migrations/011_default_wishlist.sql` | `is_default` + backfill |
| `lib/wishlists/ensure-default-wishlist.ts` | Idempotent default wishlist helper |
| `lib/wishlists/ensure-default-wishlist.test.ts` | Helper tests (mocked supabase) |
| `app/api/products/route.ts` | Auto-assign default wishlist |
| `app/api/wishlists/route.ts` | Ensure default on GET |
| `app/api/wishlists/[id]/route.ts` | Block delete/rename of default |
| `components/add-product-form.tsx` | Default Other, remove None option |
| `mobile/app/products/add.tsx` | Full add flow parity |
| `mobile/app/wishlists/[id].tsx` | Inline add section |
| `app/(dashboard)/products/[id]/page.tsx` | Chips, hide URL, reference price |
| `mobile/app/products/[id].tsx` | Same detail UX changes |
| `components/summary-bar.tsx` | P3 home summary |
| `components/toast.tsx` | P3 Web toast provider |
| `mobile/lib/toast.ts` | P3 Mobile toast helper |
| `mobile/app/settings.tsx` | P3 "How tracking works" section |

---

# Phase P1 — Foundation

### Task 1: Display formatters

**Files:**
- Create: `lib/format/display.ts`
- Create: `lib/format/display.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/format/display.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatRelativeTime,
  formatPriceChange,
  formatDistanceToTarget,
} from "./display";

describe("formatRelativeTime", () => {
  afterEach(() => vi.useRealTimers());

  it("returns em dash for null", () => {
    expect(formatRelativeTime(null)).toBe("—");
  });

  it('returns "just now" for < 60s ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
    expect(formatRelativeTime("2026-06-20T11:59:30Z")).toBe("just now");
  });

  it("returns minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
    expect(formatRelativeTime("2026-06-20T11:55:00Z")).toBe("5m ago");
  });

  it("returns hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
    expect(formatRelativeTime("2026-06-20T09:00:00Z")).toBe("3h ago");
  });
});

describe("formatPriceChange", () => {
  it("returns null when amount is null", () => {
    expect(formatPriceChange(null, null, "USD")).toBeNull();
  });

  it("formats drop with down arrow", () => {
    const result = formatPriceChange(-5.2, -5.8, "USD");
    expect(result?.text).toContain("↓");
    expect(result?.direction).toBe("down");
  });

  it("formats rise with up arrow", () => {
    const result = formatPriceChange(3, 3.2, "USD");
    expect(result?.text).toContain("↑");
    expect(result?.direction).toBe("up");
  });
});

describe("formatDistanceToTarget", () => {
  it("returns null when distance is null", () => {
    expect(formatDistanceToTarget(null, "USD")).toBeNull();
  });

  it('returns "Target met!" when distance <= 0', () => {
    expect(formatDistanceToTarget(-2, "USD")?.text).toBe("Target met!");
  });

  it("formats above target", () => {
    const result = formatDistanceToTarget(3.2, "USD");
    expect(result?.text).toContain("above target");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- lib/format/display.test.ts`

- [ ] **Step 3: Implement `lib/format/display.ts`**

```typescript
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

function formatUsdAmount(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  if (diff < MS_MINUTE) return "just now";
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MINUTE)}m ago`;
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)}h ago`;
  if (diff < MS_DAY * 2) return "yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(iso)
  );
}

export type PriceChangeDisplay = {
  text: string;
  direction: "down" | "up" | "flat";
};

export function formatPriceChange(
  amount: number | null,
  percent: number | null,
  currency: string
): PriceChangeDisplay | null {
  if (amount === null) return null;
  const direction: PriceChangeDisplay["direction"] =
    amount < 0 ? "down" : amount > 0 ? "up" : "flat";
  const arrow = direction === "down" ? "↓" : direction === "up" ? "↑" : "→";
  const absAmount = formatUsdAmount(amount, currency);
  const pct =
    percent !== null && Number.isFinite(percent)
      ? ` (${Math.abs(percent).toFixed(1)}%)`
      : "";
  return { text: `${arrow} ${absAmount}${pct}`, direction };
}

export type DistanceDisplay = { text: string; met: boolean };

export function formatDistanceToTarget(
  distance: number | null,
  currency: string
): DistanceDisplay | null {
  if (distance === null) return null;
  if (distance <= 0) return { text: "Target met!", met: true };
  return {
    text: `${formatUsdAmount(distance, currency)} above target`,
    met: false,
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- lib/format/display.test.ts`

- [ ] **Step 5: Copy to mobile**

Create `mobile/lib/format-display.ts` with the same three exports (identical logic, no React imports).

- [ ] **Step 6: Commit**

```bash
git add lib/format/display.ts lib/format/display.test.ts mobile/lib/format-display.ts
git commit -m "feat(ux): add shared display formatters for relative time and price copy"
```

---

### Task 2: Computed product fields

**Files:**
- Modify: `lib/api/product-map.ts`
- Modify: `lib/types/product.ts`
- Create: `lib/api/product-map.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/api/product-map.test.ts
import { describe, it, expect } from "vitest";
import { mapProduct, type ProductRow } from "./product-map";

function row(overrides: Partial<ProductRow>): ProductRow {
  return {
    id: "1",
    url: "https://www.amazon.com/dp/B0TEST",
    title: "Test",
    target_price: 80,
    discount_alert_percent: null,
    baseline_price: 100,
    currency: "USD",
    last_price: 90,
    last_fetched_at: null,
    wishlist_item_id: null,
    availability_status: "in_stock",
    consecutive_failures: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("mapProduct computed fields", () => {
  it("computes priceChange from baseline", () => {
    const p = mapProduct(row({ last_price: 90, baseline_price: 100 }));
    expect(p.priceChange).toBe(-10);
    expect(p.priceChangePercent).toBe(-10);
  });

  it("returns null change when baseline missing", () => {
    const p = mapProduct(row({ baseline_price: null }));
    expect(p.priceChange).toBeNull();
    expect(p.priceChangePercent).toBeNull();
  });

  it("computes distanceToTarget", () => {
    const p = mapProduct(row({ last_price: 90, target_price: 80 }));
    expect(p.distanceToTarget).toBe(10);
    expect(p.targetMet).toBe(false);
  });

  it("sets targetMet when at or below target", () => {
    expect(mapProduct(row({ last_price: 80, target_price: 80 })).targetMet).toBe(true);
    expect(mapProduct(row({ last_price: 75, target_price: 80 })).targetMet).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- lib/api/product-map.test.ts`

- [ ] **Step 3: Add helpers and extend mapProduct**

Add to `lib/api/product-map.ts`:

```typescript
function computePriceChange(lastPrice: number | null, baselinePrice: number | null) {
  if (lastPrice === null || baselinePrice === null) {
    return { priceChange: null, priceChangePercent: null };
  }
  const priceChange = lastPrice - baselinePrice;
  const priceChangePercent =
    baselinePrice > 0 ? (priceChange / baselinePrice) * 100 : null;
  return { priceChange, priceChangePercent };
}

function computeDistanceToTarget(lastPrice: number | null, targetPrice: number | null) {
  if (lastPrice === null || targetPrice === null) {
    return { distanceToTarget: null, targetMet: false };
  }
  const distanceToTarget = lastPrice - targetPrice;
  return { distanceToTarget, targetMet: lastPrice <= targetPrice };
}
```

Spread results into `mapProduct` return object.

Update `lib/types/product.ts`:

```typescript
  priceChange: number | null;
  priceChangePercent: number | null;
  distanceToTarget: number | null;
  targetMet: boolean;
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- lib/api/product-map.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/api/product-map.ts lib/api/product-map.test.ts lib/types/product.ts
git commit -m "feat(ux): add computed price change and target distance to mapProduct"
```

---

### Task 3: Product sort utility

**Files:**
- Create: `lib/products/sort-products.ts`
- Create: `lib/products/sort-products.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { sortProductsByUrgency } from "./sort-products";
import type { Product } from "@/lib/types/product";

function product(overrides: Partial<Product>): Product {
  return {
    id: "x",
    url: "https://amazon.com/dp/1",
    title: "Item",
    targetPrice: null,
    discountAlertPercent: null,
    baselinePrice: 100,
    currency: "USD",
    lastPrice: 100,
    lastFetchedAt: null,
    wishlistItemId: null,
    availabilityStatus: "in_stock",
    site: "amazon",
    siteName: "Amazon",
    alertActive: false,
    consecutiveFailures: 0,
    autoRefreshPaused: false,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    priceChange: 0,
    priceChangePercent: 0,
    distanceToTarget: null,
    targetMet: false,
    ...overrides,
  };
}

describe("sortProductsByUrgency", () => {
  it("puts alertActive first", () => {
    const sorted = sortProductsByUrgency([
      product({ id: "a", alertActive: false }),
      product({ id: "b", alertActive: true }),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("sorts by smallest distanceToTarget when no alert", () => {
    const sorted = sortProductsByUrgency([
      product({ id: "far", distanceToTarget: 20, targetPrice: 80, lastPrice: 100 }),
      product({ id: "near", distanceToTarget: 2, targetPrice: 98, lastPrice: 100 }),
    ]);
    expect(sorted[0].id).toBe("near");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement sort**

```typescript
import type { Product } from "@/lib/types/product";

export function sortProductsByUrgency(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    if (a.alertActive !== b.alertActive) return a.alertActive ? -1 : 1;

    const aDist = a.distanceToTarget;
    const bDist = b.distanceToTarget;
    if (aDist !== null && bDist !== null && aDist !== bDist) {
      return aDist - bDist;
    }
    if (aDist !== null && bDist === null) return -1;
    if (aDist === null && bDist !== null) return 1;

    const aChange = Math.abs(a.priceChange ?? 0);
    const bChange = Math.abs(b.priceChange ?? 0);
    if (aChange !== bChange) return bChange - aChange;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
```

Copy equivalent to `mobile/lib/sort-products.ts` (same logic, import mobile Product type or inline interface).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

---

### Task 4: Web ProductCard component

**Files:**
- Create: `components/product-card.tsx`
- Modify: `components/product-list.tsx`
- Modify: `components/dashboard-content.tsx`

- [ ] **Step 1: Create `components/product-card.tsx`**

Client component using `Product` type, `formatRelativeTime`, `formatPriceChange`, `formatDistanceToTarget` from `@/lib/format/display`. Layout per spec: title left / price right (L1), change + distance row, site + time footer (muted). Link wraps card → `/products/[id]`. Green text for `direction === "down"`, red for `"up"`. Show bell icon or "Alert" chip when `alertActive`. Show "Updates paused" subtle banner when `autoRefreshPaused`.

- [ ] **Step 2: Replace table in `product-list.tsx`**

Remove `<table>` markup. Map `products` to `<ProductCard key={id} product={p} onDelete={...} />` in a `div` with `space-y-3`. Keep delete via card overflow menu or trailing icon button (not confirm on every render — keep existing confirm flow).

- [ ] **Step 3: Apply sort in `dashboard-content.tsx`**

```typescript
import { sortProductsByUrgency } from "@/lib/products/sort-products";
// after fetch:
setProducts(sortProductsByUrgency(data.products ?? []));
```

Remove the cron footer paragraph from `product-list.tsx` (P3 will move to settings; remove now per P1 spec).

- [ ] **Step 4: Manual verify**

Run: `npm run dev` → open dashboard → cards visible, no URL column, relative time shown.

- [ ] **Step 5: Commit**

```bash
git add components/product-card.tsx components/product-list.tsx components/dashboard-content.tsx
git commit -m "feat(ux): replace product table with unified cards on web"
```

---

### Task 5: Mobile ProductCard + home sort

**Files:**
- Modify: `mobile/components/product-card.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Expand `ProductListItem` type** to match API fields: `targetPrice`, `baselinePrice`, `lastFetchedAt`, `priceChange`, `priceChangePercent`, `distanceToTarget`, `targetMet`, `autoRefreshPaused`, `createdAt`.

- [ ] **Step 2: Rebuild card layout** mirroring Web hierarchy using `mobile/lib/format-display.ts`.

- [ ] **Step 3: Sort in index.tsx**

```typescript
import { sortProductsByUrgency } from "@/lib/sort-products";
setProducts(sortProductsByUrgency(data.products ?? []));
```

- [ ] **Step 4: Commit**

```bash
git add mobile/components/product-card.tsx mobile/app/(tabs)/index.tsx mobile/lib/sort-products.ts
git commit -m "feat(ux): upgrade mobile product cards and urgency sort"
```

---

**P1 checkpoint:** Run `npm test` and verify Web + Mobile list views manually.

---

# Phase P2 — Flow parity

### Task 6: Default wishlist migration

**Files:**
- Create: `supabase/migrations/011_default_wishlist.sql`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_one_default_per_user
  ON public.wishlist_items (user_id)
  WHERE is_default = true;

-- Backfill: users with orphan products get an Other wishlist
DO $$
DECLARE
  r RECORD;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT tp.user_id
    FROM public.tracked_products tp
    WHERE tp.wishlist_item_id IS NULL
  LOOP
    INSERT INTO public.wishlist_items (user_id, name, is_default)
    VALUES (r.user_id, 'Other', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO new_id;

    IF new_id IS NULL THEN
      SELECT id INTO new_id FROM public.wishlist_items
      WHERE user_id = r.user_id AND is_default = true LIMIT 1;
    END IF;

    UPDATE public.tracked_products
    SET wishlist_item_id = new_id
    WHERE user_id = r.user_id AND wishlist_item_id IS NULL;
  END LOOP;
END $$;
```

Note: adjust backfill if unique index conflicts — use `SELECT id ... WHERE is_default` pattern.

- [ ] **Step 2: Apply locally**

Run: `npm run db:catchup` (or apply migration via Supabase CLI)

- [ ] **Step 3: Commit**

---

### Task 7: ensureDefaultWishlist helper

**Files:**
- Create: `lib/wishlists/ensure-default-wishlist.ts`
- Create: `lib/wishlists/ensure-default-wishlist.test.ts`
- Modify: `app/api/products/route.ts`
- Modify: `app/api/wishlists/route.ts`

- [ ] **Step 1: Implement helper**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_NAME = "Other";

export async function ensureDefaultWishlist(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string }> {
  const { data: existing } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (existing?.id) return { id: existing.id };

  const { data: created, error } = await supabase
    .from("wishlist_items")
    .insert({ user_id: userId, name: DEFAULT_NAME, is_default: true })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: created.id };
}
```

- [ ] **Step 2: Wire POST /api/products**

When `wishlistItemId` absent/empty, call `ensureDefaultWishlist` and use returned `id`.

- [ ] **Step 3: Wire GET /api/wishlists**

After fetching wishlists, if none has `is_default`, call `ensureDefaultWishlist` and re-fetch (or append to response).

- [ ] **Step 4: Commit**

---

### Task 8: Protect default wishlist

**Files:**
- Modify: `app/api/wishlists/[id]/route.ts`
- Modify: `getOwnedWishlist` select to include `is_default`

- [ ] **Step 1: Block DELETE and PATCH rename when `is_default`**

```typescript
if (wishlist.is_default) {
  return jsonError(409, "Cannot delete the default wishlist");
}
```

Same for PATCH with message `"Cannot rename the default wishlist"`.

- [ ] **Step 2: Commit**

---

### Task 9: Web add form — default Other

**Files:**
- Modify: `components/add-product-form.tsx`

- [ ] **Step 1: On wishlists load**, set `wishlistItemId` to the wishlist where `isDefault === true` (add field to API response).

- [ ] **Step 2: Remove `<option value="">None</option>`** from select.

- [ ] **Step 3: Commit**

---

### Task 10: Mobile add flow parity

**Files:**
- Modify: `mobile/app/products/add.tsx`

- [ ] **Step 1: Add state** for `targetPrice`, `discountAlertPercent`, `wishlistItemId`, `wishlists[]` (mirror Web).

- [ ] **Step 2: Fetch wishlists** on mount; default to `Other`.

- [ ] **Step 3: Show alert fields + picker** after preview card (same validation as Web).

- [ ] **Step 4: POST body** includes `targetPrice`, `discountAlertPercent`, `wishlistItemId`.

- [ ] **Step 5: On success** `router.back()` instead of `router.replace(/products/id)`; show brief success feedback (Alert or inline banner until P3 toast).

- [ ] **Step 6: Commit**

---

### Task 11: Mobile wishlist detail add form

**Files:**
- Modify: `mobile/app/wishlists/[id].tsx`

- [ ] **Step 1: Add embedded add UI** at top of FlatList `ListHeaderComponent` — URL row, preview, optional alerts (wishlist fixed from route `id`). Reuse same handlers as `add.tsx` or extract `mobile/components/add-product-section.tsx`.

- [ ] **Step 2: Commit**

---

### Task 12: Product detail — reference price + chips + hide URL

**Files:**
- Modify: `app/(dashboard)/products/[id]/page.tsx`
- Modify: `mobile/app/products/[id].tsx`

- [ ] **Step 1: Remove prominent URL block**; add button `Open in browser` using `window.open` / `WebBrowser.openBrowserAsync`.

- [ ] **Step 2: Above target price input**, show `Current price: {formatPrice(lastPrice)}`.

- [ ] **Step 3: Add chip buttons** `-10%`, `-20%`, `Set to current`:
  - `-10%` → `setTargetPriceInput(String((lastPrice * 0.9).toFixed(2)))`
  - `-20%` → `lastPrice * 0.8`
  - `Set to current` → `String(lastPrice)`

- [ ] **Step 4: Rename baseline label** to "Price when added" near discount field only.

- [ ] **Step 5: Add optional `imageUrl?: string | null` to detail type** — render `<img>` only when present (no fetch).

- [ ] **Step 6: Commit**

---

**P2 checkpoint:** Add product on Mobile with alerts; verify lands in Other; wishlist detail add works; cannot delete Other.

---

# Phase P3 — Polish

### Task 13: Summary bar

**Files:**
- Create: `components/summary-bar.tsx`
- Modify: `components/dashboard-content.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Compute** `priceDropCount` = products where `priceChange < 0`. Fetch unread notification count from `/api/notifications` (count `readAt === null`).

- [ ] **Step 2: Render bar** `"2 price drops · 1 unread"` with links to filtered view / notifications tab.

- [ ] **Step 3: Commit**

---

### Task 14: Toast system

**Files:**
- Create: `components/toast.tsx` + context in `app/(dashboard)/layout.tsx`
- Create: `mobile/lib/toast.ts` (simple `Alert.alert` wrapper or `react-native-toast-message` if already dep — prefer zero-dep `Alert` for minimal scope)

- [ ] **Step 1: Web toast provider** with `showToast(message, variant)`.

- [ ] **Step 2: Replace inline success strings** on detail save and add product flows.

- [ ] **Step 3: Mobile** use same copy via toast helper on add/save.

- [ ] **Step 4: Commit**

---

### Task 15: Skeleton loading + empty states

**Files:**
- Create: `components/product-card-skeleton.tsx`
- Modify: `components/dashboard-content.tsx`, `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Skeleton** — 3 placeholder cards pulsing.

- [ ] **Step 2: Empty state** — title "No products yet", subtitle "Paste a product link to start tracking", preserve `+` hint.

- [ ] **Step 3: Commit**

---

### Task 16: Notifications badge + Settings help

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Modify: `mobile/app/settings.tsx`
- Modify: `app/(dashboard)/layout.tsx` (if web nav has notifications link)

- [ ] **Step 1: Poll or fetch unread count** for tab badge on notifications icon.

- [ ] **Step 2: Add Settings section "How tracking works"** with cron interval, inactivity pause, supported sites (text from old dashboard footer).

- [ ] **Step 3: Commit**

---

**P3 checkpoint:** Full UX walkthrough Web + Mobile per spec checklist.

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Computed API fields | Task 2 |
| formatRelativeTime etc. | Task 1 |
| Unified ProductCard | Tasks 4, 5 |
| Urgency sort | Task 3 |
| Hide URL from list | Tasks 4, 5 |
| Default Other wishlist | Tasks 6, 7, 8, 9 |
| Mobile add parity | Task 10 |
| Wishlist detail add (mobile) | Task 11 |
| Detail chips + reference price | Task 12 |
| Summary bar | Task 13 |
| Toast | Task 14 |
| Skeleton + empty states | Task 15 |
| Notification badge + settings help | Task 16 |
| imageUrl hook only | Task 12 step 5 |
| English UI | All copy in English |

---

## Final verification

```bash
npm test
npm run lint
npm run build
```

Manual: Web dashboard cards, add with alerts, detail chips, Other wishlist. Mobile: same flows on Android emulator/device.
