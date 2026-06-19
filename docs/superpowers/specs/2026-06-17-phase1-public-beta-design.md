# Phase 1 — Public Beta Launch — Design Spec

**Date:** 2026-06-17  
**Status:** Approved (brainstorming)  
**Parent:** `docs/superpowers/specs/2026-06-17-price-watch-design.md`  
**Skill:** `.cursor/skills/price-watch-mvp/SKILL.md`

## Summary

Take Price Watch from MVP to **public beta**: anyone can register and track products on **Amazon, Flipkart, Meesho, eBay**, with **generic HTML** as fallback. Ship in three waves using a **risk-first** strategy — protect API costs and operability before expanding site parsers and UX polish.

## Decisions (brainstorming)

| Item | Decision |
|------|----------|
| Launch tier | Public beta (open registration) |
| Supported sites | Amazon, Flipkart, Meesho, eBay + generic HTML fallback |
| Implementation strategy | **Wave 1 → 2 → 3** (risk-first, Approach 3) |
| Rate limiting | Supabase table + RPC (no Redis) |
| Monitoring | Sentry + business metrics + proactive email/Slack alerts |
| Auth | Forgot password, email verification, Google OAuth |
| Architecture | Keep 3-layer monolith; no microservices or job queues |

## Goals

- Production deployment with all migrations applied and env vars documented.
- Cost guardrails so ZenRows cannot be abused after public launch.
- Operator visibility: know when cron or per-site fetch health degrades.
- Legal minimum for public users (Privacy, Terms, signup consent).
- Reliable parsing for four named marketplaces; honest UX for unsupported URLs.
- Auth flows expected of a public app (password reset, Google sign-in).

## Non-Goals (Phase 1)

- Stripe billing, plans, or usage-based pricing (Phase 2).
- Browser extension, mobile app, Web Push.
- Multi-provider failover, distributed job queues.
- Cross-site product matching, AI, recommendations.
- User-selectable display currency (remain USD-normalized).
- Full GDPR data-export portal (defer; include contact email in Privacy).

---

## Wave Plan

```
Wave 1 (risk + launch)     Wave 2 (sites)           Wave 3 (experience)
─────────────────────     ────────────────         ───────────────────
Rate limits               Amazon hardening         Forgot password UI
Sentry + alerts           Flipkart parser          Google OAuth UI
Legal pages               Meesho parser            Email verification gate
Prod deploy checklist     eBay parser              UX debt (alertActive, etc.)
Migrations 006+007        is_available handling    E2E (Playwright)
Health-check cron         Site badge UI            Notification bell refresh
Middleware API 401 fix    Per-site metrics
```

Waves are sequential gates: **do not open public registration until Wave 1 is complete.**

---

## 1. Architecture

Unchanged from MVP:

```
Frontend (Next.js) → API Routes → PriceProvider → ZenRows
                         ↓
                  Supabase PostgreSQL
                         ↓
              Sentry + pipeline_events + daily_stats
                         ↓
              Alert email/Slack (operator)
```

### New modules (within existing layers)

| Module | Location | Purpose |
|--------|----------|---------|
| Site detection | `lib/providers/detect-site.ts` | Map URL → site key |
| Site parsers | `lib/providers/sites/*.ts` | Flipkart, Meesho, eBay rules |
| Rate limiter | `lib/api/rate-limit.ts` | Call Supabase RPC before ZenRows routes |
| Pipeline events | `lib/observability/pipeline-event.ts` | Structured success/fail logging |
| Health check | `app/api/cron/health-check/route.ts` | Operator alerts |

`ZenRowsProvider` routes by `detectSite(url)`:

1. `amazon` → existing ASIN API path (marketplace mapping already present).
2. `flipkart` | `meesho` | `ebay` → universal ZenRows fetch + site-specific `parsePriceFromHtml` branch.
3. `generic` → existing universal HTML parser; UI shows “unsupported site” badge.

Core pipeline steps (input → fetch → normalize → persist → evaluate → notify) are unchanged.

---

## 2. Site Support

### Site detection

```typescript
type SupportedSite = "amazon" | "flipkart" | "meesho" | "ebay" | "generic";

function detectSite(url: string): SupportedSite;
```

| Host pattern | Site |
|--------------|------|
| `*.amazon.*` | `amazon` |
| `*.flipkart.com` | `flipkart` |
| `*.meesho.com` | `meesho` |
| `*.ebay.*` | `ebay` |
| else | `generic` |

### Parser requirements

| Site | ZenRows config | Parse strategy |
|------|----------------|----------------|
| Amazon | Ecommerce ASIN API + `country` from hostname | Existing; verify `is_available` |
| Flipkart | `js_render`, `premium_proxy`, `proxy_country: in` | JSON-LD `offers.price`, fallback CSS class selectors |
| Meesho | `js_render`, `premium_proxy`, `proxy_country: in` | Embedded `__NEXT_DATA__` or meta price tags |
| eBay | `js_render`, `proxy_country` from listing TLD | JSON-LD / `x-price-primary` patterns |
| Generic | Universal fetch | Existing `parse-price.ts`; lowest confidence |

### Availability

Extend `PriceFetchResult`:

```typescript
interface PriceFetchResult {
  price: number;
  currency: string;
  title?: string;
  isAvailable?: boolean; // default true when unknown
}
```

When `isAvailable === false`:

- Persist snapshot and update `last_price` / `last_fetched_at`.
- Skip alert evaluation.
- Expose `availability: "out_of_stock"` on product API for UI badge.

### User-facing site UX

- After preview: show site badge (`Amazon`, `Flipkart`, etc.).
- `generic`: badge “Unsupported site — results may be inaccurate”.
- Preview failure: include `site` in error context for support.

---

## 3. Rate Limiting (Supabase)

### Schema (`007_rate_limits.sql`)

```sql
create table api_usage_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  window_start timestamptz not null,
  request_count int not null default 0,
  primary key (user_id, endpoint, window_start)
);

create index idx_api_usage_cleanup on api_usage_windows (window_start);
```

### RPC

```sql
create or replace function check_and_increment_usage(
  p_user_id uuid,
  p_endpoint text,
  p_window_minutes int,
  p_limit int
) returns jsonb ...
```

Returns `{ allowed: boolean, retry_after_seconds: int, current_count: int }`.

Atomically: compute `window_start = date_trunc('hour', now())` (or minute bucket), upsert count, compare to limit.

### Limits (public beta defaults)

| Endpoint key | Route | Limit |
|--------------|-------|-------|
| `preview` | `POST /api/products/preview` | 30 / user / hour |
| `add_product` | `POST /api/products` | 20 / user / day |
| `refresh` | `POST /api/products/[id]/refresh` | 40 / user / day (plus existing 15 min per-product cooldown) |

Cron routes (`/api/cron/*`) bypass user rate limits; protected by `CRON_SECRET` only.

### API behavior

- Before ZenRows call: `checkRateLimit(supabase, userId, endpoint)`.
- If denied: `429` with `{ error, retryAfterSeconds }`.
- Response header: `Retry-After`.

---

## 4. Monitoring & Operator Alerts

### Sentry

- Package: `@sentry/nextjs`.
- Capture unhandled API errors and pipeline exceptions.
- Tag events with `site`, `endpoint`, `trackedProductId` where available.
- Do not send ZenRows API keys or raw HTML to Sentry.

### Pipeline events table (`007` or `008`)

```sql
create table pipeline_events (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid references tracked_products(id) on delete set null,
  site text not null,
  step text not null,        -- 'fetch' | 'normalize' | 'persist' | 'alert'
  success boolean not null,
  duration_ms int,
  error_code text,
  created_at timestamptz default now()
);
create index idx_pipeline_events_time on pipeline_events (created_at desc);
create index idx_pipeline_events_site on pipeline_events (site, created_at desc);
```

Insert from `runPricePipeline` on fetch success/failure (service role or authenticated insert policy via product ownership).

### Daily stats (cron aggregation)

`POST /api/cron/aggregate-stats` (daily, `CRON_SECRET`):

- Count `pipeline_events` failures by `site` in last 24h.
- Count new users, new products, alerts sent.
- Upsert `daily_stats` row for dashboard SQL / future admin UI.

### Health check & alerts

`POST /api/cron/health-check` every hour:

| Check | Threshold | Action |
|-------|-----------|--------|
| Last refresh-prices cron | No successful run in 7h | Alert |
| Refresh success rate | < 80% in last 6h (from pipeline_events) | Alert |
| Preview failure rate | > 50% in last 1h | Alert |
| Any site failure rate | > 70% in last 6h per site | Alert with site name |

Alert channel: `OPERATOR_ALERT_EMAIL` and/or `SLACK_WEBHOOK_URL` via Resend / `fetch`.

### Environment variables (new)

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Error tracking |
| `SENTRY_AUTH_TOKEN` | CI source maps (optional) |
| `OPERATOR_ALERT_EMAIL` | Operator alert recipient |
| `SLACK_WEBHOOK_URL` | Optional Slack alerts |

---

## 5. Authentication

### Forgot password

- Page: `/forgot-password` — email input → `supabase.auth.resetPasswordForEmail`.
- Page: `/reset-password` — handle recovery token from email link.
- Login page link: “Forgot password?”

### Email verification

- After signup: show “Check your email to verify”.
- Supabase setting: require verified email for sensitive actions.
- **Gate:** unverified users cannot `POST /api/products` or `POST /api/products/preview` (403 with message).
- Verified users: full access within rate limits.

### Google OAuth

- Enable Google provider in Supabase Dashboard.
- Login + Register pages: “Continue with Google” button (`signInWithOAuth`).
- Callback: existing Supabase middleware session flow.
- Redirect URLs: production + localhost configured in Supabase.

### Middleware fix

- Paths starting with `/api/` (except `/api/cron`): if no session, return `401` JSON `{ error: "Unauthorized" }`, not 302 to `/login`.
- Page routes: keep redirect to `/login`.

---

## 6. Legal & Compliance

### Pages

| Path | Content |
|------|---------|
| `/privacy` | Data collected, third parties (Supabase, ZenRows, Resend, Sentry), retention, contact email, India/international note |
| `/terms` | As-is service, user responsible for URLs, no price accuracy guarantee, beta disclaimer |

### Signup

- Checkbox: “I agree to the Terms of Service and Privacy Policy” (required).
- Links open in new tab.

### Email alerts (user-facing)

- Footer line: “Manage alerts in your dashboard” + link to app.
- Phase 1: no marketing emails; transactional only.

### Footer

- Dashboard layout footer: Privacy | Terms | Contact email.

---

## 7. UX Debt (Wave 3)

| Item | Change |
|------|--------|
| Alert highlighting | API returns `alertActive: boolean` on product list/detail; remove client `evaluateAlert` |
| Price history | API paginates: `?limit=90&offset=0`; detail page loads more on demand |
| Notification bell | Refetch unread count on route change + 60s interval |
| Product detail | Add delete button (same flow as dashboard list) |
| Dashboard errors | Show banner when product list fetch fails; disable add form |
| Site badge | Show on preview card and product list row |

---

## 8. Testing & Deployment

### Unit tests

- `detect-site.ts` — all host patterns.
- Per-site HTML fixtures in `lib/providers/sites/__fixtures__/`.
- `check_and_increment_usage` logic (mock Supabase or SQL test).
- Rate limit helper returns correct `retryAfterSeconds`.

### E2E (Playwright)

One happy path with mocked ZenRows/fetch:

1. Register (or login fixture user).
2. Preview Amazon URL → see price.
3. Add product with target price.
4. Assert product appears in dashboard list.

Run in CI on PR (GitHub Actions).

### Production checklist

- [ ] All migrations `001`–`007` applied on production Supabase.
- [ ] Vercel env: Supabase, ZenRows, Resend, `CRON_SECRET`, Sentry, operator alert email.
- [ ] Google OAuth redirect URLs configured.
- [ ] Resend domain verified; `RESEND_FROM_EMAIL` on verified domain.
- [ ] Vercel crons: `refresh-prices` (6h), `health-check` (1h), `aggregate-stats` (daily).
- [ ] Supabase RLS smoke test with anon + authenticated clients.
- [ ] Manual test: add product on each of four sites from production.

---

## 9. Success Criteria

Public beta is ready when:

- [ ] Wave 1 complete: rate limits, Sentry, legal pages, health alerts, prod deployed.
- [ ] Wave 2 complete: all four sites parse in staging with recorded success; `is_available` respected.
- [ ] Wave 3 complete: auth flows work; E2E green; UX debt items shipped.
- [ ] Operator receives test alert from health-check cron.
- [ ] Preview returns 429 when limit exceeded.
- [ ] Unauthenticated `/api/products` returns 401 JSON.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Flipkart/Meesho DOM changes break parsers | Per-site fixtures + failure rate alert per site |
| ZenRows cost spike | Wave 1 rate limits before public launch |
| Meesho heavy JS / anti-bot | `js_render` + monitor Meesho-specific failure rate; document known instability |
| Supabase rate-limit table growth | Daily cron deletes rows older than 7 days |
| Google OAuth misconfiguration | Document exact redirect URIs in checklist |

---

## Appendix: File Touch List (implementation hint)

| Wave | Files |
|------|-------|
| 1 | `supabase/migrations/007_*.sql`, `lib/api/rate-limit.ts`, `app/api/cron/health-check/`, `sentry.*.config.ts`, `app/privacy/`, `app/terms/`, `middleware.ts` |
| 2 | `lib/providers/detect-site.ts`, `lib/providers/sites/`, `lib/providers/zenrows.ts`, `lib/providers/parse-price.ts` |
| 3 | `app/(auth)/forgot-password/`, `app/(auth)/reset-password/`, login/register OAuth buttons, `lib/api/product-map.ts`, `components/product-list.tsx`, `e2e/` |
