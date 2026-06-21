# UX Overhaul — Design Spec

**Date:** 2026-06-20  
**Status:** Approved (brainstorming)  
**Parent:** `docs/superpowers/specs/2026-06-17-price-watch-design.md`  
**Skill:** `.cursor/skills/price-watch-mvp/SKILL.md`

## Summary

Deliver a **unified Mobile + Web UX overhaul** for Price Watch: glanceable product cards, humanized data, hidden technical noise, contextual flows, and smart defaults. Implementation uses **phased delivery** (Foundation → Flow parity → Polish) with both clients shipping each phase together. English UI throughout.

## Decisions (brainstorming)

| Item | Decision |
|------|----------|
| Platforms | **Mobile + Web** unified interaction language |
| Primary goal | All pillars (friction, readability, visual, IA); **emphasis on information readability** |
| List presentation | **Unified card layout** on both platforms (Web migrates off table) |
| Default wishlist | **Real DB** wishlist named `Other` (`is_default`); unassigned products auto-assigned |
| Product images | **Not this release**; detail page reserves `imageUrl` hook for future official store APIs |
| UI language | **English** (wishlist default name: `Other`) |
| Implementation strategy | **Phased delivery** (Approach 2); not big-bang, not web-first |
| Visual hierarchy rule | **Prominence ∝ user concern** (price largest; source/technical info minimized) |

## Design principles

### Prominence hierarchy

| Level | Elements | Treatment |
|-------|----------|-----------|
| L1 | Current price, price change, alert triggered | Largest type, color accents (green drop / red rise), primary card position (right-aligned price) |
| L2 | Product title, distance to target | Medium weight; title max 2 lines |
| L3 | Relative update time, alert config summary | Small, muted text |
| L4 | Site/source | Small icon or faint micro-badge |
| L5 | URL, baseline, technical states | Hidden by default; reveal via "Open in browser" or expandable "More" |

### UX pillars

1. **Glanceable** — Open app → see tracked products and latest prices immediately (keep current home + `+` entry).
2. **Low friction** — Keep one-tap add entry; reduce steps where possible (auto-preview, inline alert fields on add).
3. **Hide noise** — Do not surface URLs, cron footnotes, or internal field names by default.
4. **Humanize data** — Relative times ("3h ago"), distance copy ("$3.20 above target", "Target met!").
5. **Contextual continuity** — Add from within a wishlist; set alerts during add (Web parity on Mobile); show reference price when setting thresholds.
6. **Smart defaults** — Default `Other` wishlist; session auto-login (existing Supabase persistence).

## Goals

- Users see **actionable price information** at a glance without opening detail screens.
- Mobile and Web share the same **ProductCard** information model and sort order.
- Mobile **add-product flow** matches Web (target price, discount %, wishlist picker).
- Mobile **wishlist detail** includes inline add form (Web already has this).
- All products belong to a wishlist; orphan `wishlist_item_id = null` rows eliminated for existing users.
- Technical/cron copy moved out of primary views.

## Non-Goals

- Product thumbnail scraping or new image storage (future official store API spec).
- i18n / Chinese UI.
- Manual per-product refresh button (cron-only policy unchanged).
- Search, advanced filters, custom dashboards.
- Biometric unlock (defer to mobile v2).
- Chrome extension UX changes.
- Navigation restructure (tabs stay: Products / Wishlists / Notifications).

---

## 1. Information architecture

Navigation unchanged. Content density and layout change per screen:

```
Products (home)
├── Summary bar: "2 price drops · 1 unread" (tap → notifications)
├── ProductCard[] (urgency-sorted)
└── Header + add action (keep)

Wishlists
├── Wishlist rows: name + count
└── Wishlist detail
    ├── Inline add form (alerts + fixed wishlistItemId)
    └── ProductCard[]

Product detail
├── Title (L2)
├── Price hero (L1) + change badge
├── Status chips (only when exceptional: alert / OOS / paused)
├── Price history chart (existing)
├── Alert settings with current-price reference + quick chips
└── Open in browser · Stop tracking

Add product
├── URL input + preview (auto or single-step)
├── Preview card (title + price)
├── Target price + discount % (optional)
├── Wishlist picker (default Other)
└── Add
```

**Web change:** Replace `ProductList` table with the same card component spec as Mobile.

---

## 2. Unified ProductCard

### Layout (both platforms)

```
┌─────────────────────────────────────────┐
│ Product Title (2 lines max)      $89.99 │  L1 price, right-aligned
│ ↓ $5.20 (5.8%) · Target met!       [🔔] │  L1 change / alert
│ Amazon · 3h ago                           │  L4 site + L3 time
└─────────────────────────────────────────┘
```

### Default sort (product list)

1. `alertActive === true`
2. Smallest `distanceToTarget` when `targetPrice` is set (closest to target)
3. Non-zero `priceChange` (largest absolute change first)
4. `createdAt` descending

### Hidden on card

- Full URL (navigate to detail; "Open in browser" on detail only)
- `baselinePrice`, `consecutiveFailures`, raw `lastFetchedAt`

---

## 3. API and backend

### 3a. Computed list fields (no schema change)

Extend `mapProduct()` in `lib/api/product-map.ts`:

| Field | Calculation |
|-------|-------------|
| `priceChange` | `lastPrice - baselinePrice` when both non-null |
| `priceChangePercent` | `(priceChange / baselinePrice) * 100` when baseline > 0 |
| `distanceToTarget` | `lastPrice - targetPrice` when both non-null (negative = below target) |
| `targetMet` | `targetPrice !== null && lastPrice !== null && lastPrice <= targetPrice` |

Mobile `ProductListItem` type must consume full product fields (not the current reduced subset).

### 3b. Default `Other` wishlist

**Migration `011_default_wishlist.sql`:**

- Add `is_default boolean not null default false` to `wishlist_items`.
- Partial unique index: one `is_default = true` per `user_id`.
- Backfill: for each user with tracked products where `wishlist_item_id is null`, create wishlist `Other` (`is_default = true`) and assign those products.
- For users with no products, create `Other` lazily on first product add or first wishlist fetch.

**Helper:** `lib/wishlists/ensure-default-wishlist.ts`

```typescript
ensureDefaultWishlist(supabase, userId): Promise<{ id: string }>
```

Idempotent: returns existing default if present.

**API behavior:**

- `POST /api/products` — when `wishlistItemId` omitted, resolve via `ensureDefaultWishlist` and assign.
- `DELETE /api/wishlists/[id]` — reject if `is_default === true` (409).
- `PATCH` rename — reject for default wishlist (or omit rename UI).

### 3c. Product images (deferred)

- No migration or scraping this release.
- `ProductDetail` types include optional `imageUrl?: string | null`.
- UI renders image block only when `imageUrl` is present; otherwise omit (no placeholder box).

### 3d. Shared display formatters

New module `lib/format/display.ts` (Web imports directly; Mobile mirrors in `mobile/lib/format-display.ts` or copies the same functions):

- `formatRelativeTime(iso: string | null): string` — "just now", "5m ago", "3h ago", "yesterday", then absolute date.
- `formatPriceChange(amount, percent, currency): string` — "↓ $5.20 (5.8%)" with sign semantics (drop = positive user outcome → green).
- `formatDistanceToTarget(distance, currency): string` — "$3.20 above target" / "Target met!" / "—" when no target.

---

## 4. Screen-level changes

### 4.1 Products home

| Before | After |
|--------|-------|
| Web table, Mobile minimal card | Unified ProductCard both platforms |
| No summary | Summary bar (P3): price-drop count + unread notifications |
| Absolute timestamps (Web) | Relative time on cards |
| URL visible (Web list) | URL hidden |

### 4.2 Add product

| Before | After |
|--------|-------|
| Mobile: URL + Preview only; alerts on detail | Mobile matches Web: target price, discount %, wishlist picker after preview |
| Web: separate Find + Add | Keep preview step; show alert fields once preview succeeds |
| Wishlist optional / None | Default selection: `Other`; no empty option |
| Mobile navigates to detail on success | Toast "Product added" + return to list |

### 4.3 Wishlist detail

| Before | After |
|--------|-------|
| Web: AddProductForm with fixed wishlist | Unchanged |
| Mobile: list only | Add inline add form (same fields as Web, `wishlistItemId` fixed) |

### 4.4 Product detail

| Before | After |
|--------|-------|
| Full URL prominent | URL behind "Open in browser" |
| Alert inputs without context | "Current price: $X.XX" above inputs |
| Manual entry only | Quick chips: `-10%`, `-20%`, `Set to current` (fills target from current price) |
| `baseline price` label | "Price when added" — shown only near discount % field |
| Mobile: separate Save | Keep Save; success via Toast (P3) |
| Cron/technical copy | Removed from detail |

### 4.5 Notifications

- Tab badge: unread count (P3).
- Tap notification → product detail when `trackedProductId` present (existing behavior; verify deep link).

### 4.6 Settings

- New section **"How tracking works"**: cron interval, inactivity pause, site support — migrated from dashboard footer.

---

## 5. Noise reduction checklist

| Current | Change |
|---------|--------|
| URL in list and detail | Detail: "Open in browser" only |
| `lastFetchedAt` as absolute datetime | `formatRelativeTime` on cards |
| Dashboard footer cron explanation | Settings help section |
| `autoRefreshPaused` technical message | Card/subtle banner: "Updates paused" |
| `baseline price` in UI | "Price when added" in discount context only |
| Web 7-column table | ProductCard list |

---

## 6. Phased delivery

### P1 — Foundation (highest impact)

- API computed fields in `mapProduct`
- `lib/format/display.ts` + Mobile mirror
- Unified `ProductCard` (Web new component; Mobile upgrade `product-card.tsx`)
- Web: replace table with cards
- Hide URLs from list; relative time on cards
- Urgency sort on product list
- Remove cron footer from dashboard (move copy to spec for P3 Settings)

### P2 — Flow parity

- Migration `011_default_wishlist.sql` + `ensureDefaultWishlist`
- `POST /api/products` default wishlist assignment
- Mobile add screen: alert fields + wishlist picker
- Mobile wishlist detail: inline add form
- Product detail: current-price reference + quick chips (both platforms)
- Mobile post-add: Toast + stay on list
- Protect default wishlist from delete/rename

### P3 — Polish

- Summary bar on Products home
- Skeleton loading (replace full-screen spinners on lists)
- Toast system (both platforms; remove inline success strings)
- Empty states with CTA copy
- Notifications tab unread badge
- Settings "How tracking works" section

Each phase ships **Web + Mobile together** before starting the next.

---

## 7. Error handling

- Computed fields: when `baselinePrice` or `lastPrice` is null, omit change badges (no misleading zeros).
- `ensureDefaultWishlist` failure on add → 500 with clear error; do not create product without wishlist assignment.
- Default wishlist delete → 409 `"Cannot delete the default wishlist"`.
- Quick chips on detail: validate same rules as existing target/discount inputs before PATCH.
- Toast errors for network failures; inline errors remain for form validation.

---

## 8. Testing

| Area | Cases |
|------|-------|
| Migration | Existing users get `Other`; null `wishlist_item_id` rows assigned; idempotent re-run safe |
| Default wishlist | Add without `wishlistItemId` → product in `Other`; cannot delete `Other` |
| Computed fields | Correct `priceChange`, `distanceToTarget`, `targetMet`; null-safe |
| Sort | Alert-active first; then distance; then change magnitude |
| ProductCard | Same mock payload renders equivalent info Web vs Mobile |
| Add flow | Mobile alert fields POST same body shape as Web |
| Wishlist add | Mobile wishlist detail form pins `wishlistItemId` |
| Chips | `-20%` sets target to 80% of current price; validates bounds |
| Relative time | Boundary strings at 0m, 59m, 1h, 23h, yesterday |

---

## 9. Architecture constraints (unchanged)

```
Frontend (Web + Mobile) → REST API → Supabase
                              ↓
                        PriceProvider (preview/add only)
```

- No scraping or pricing logic in frontend.
- No new microservices.
- Price refresh remains cron-only.
- Pipeline steps and alert evaluation unchanged.

## Implementation checklist

```
- [ ] Computed fields in mapProduct; Mobile types updated
- [ ] formatRelativeTime shared (Web + Mobile)
- [ ] ProductCard unified spec; Web table removed
- [ ] Prominence hierarchy applied (price L1, site L4)
- [ ] Migration 011 + ensureDefaultWishlist
- [ ] Mobile add flow parity with Web
- [ ] Mobile wishlist detail add form
- [ ] Detail: reference price + chips; URL hidden
- [ ] Phased P1 → P2 → P3 with both clients per phase
- [ ] No image scraping; imageUrl hook only
- [ ] English UI; default wishlist name "Other"
- [ ] No manual refresh, no i18n, no extension changes
```
