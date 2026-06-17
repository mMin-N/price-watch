# Price Watch MVP — Design Spec

**Date:** 2026-06-17  
**Status:** Approved (brainstorming)  
**Skill:** `.cursor/skills/price-watch-mvp/SKILL.md`

## Summary

A multi-user price tracking and wishlist web app. Users add product URLs; the backend fetches prices via ZenRows, stores append-only history, and triggers in-app + email alerts when price meets a target. Built as a Next.js monolith with Supabase Auth/PostgreSQL, deployed on Vercel.

## Decisions

| Item | Decision |
|------|----------|
| Users | Multi-user, email/password |
| Stack | Next.js (App Router + API Routes) + Supabase PostgreSQL |
| Auth | Supabase Auth |
| Alerts | In-app notifications + email (Resend) |
| Price updates | Cron every 6 hours + manual refresh (15 min cooldown) |
| Architecture | Option A: Next.js monolith + Supabase (recommended and chosen) |

## Non-Goals

Per project skill — explicitly out of scope:

- Cross-platform product matching
- AI-based product understanding
- Market intelligence / predictions
- Recommendation systems
- Multi-tenant SaaS scaling architecture
- Real-time streaming systems
- Microservices, Kafka, complex orchestration

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js (App Router)                                   │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ Pages (RSC)  │  │ API Routes                       │ │
│  │ - login/reg  │  │ - /api/wishlists                 │ │
│  │ - dashboard  │  │ - /api/products                  │ │
│  │ - wishlists  │  │ - /api/products/[id]/refresh     │ │
│  │ - product    │  │ - /api/notifications             │ │
│  │ - notifs     │  │ - /api/cron/refresh-prices 🔒    │ │
│  └──────────────┘  └──────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   Supabase Auth    Supabase PostgreSQL    ZenRows API
   (email/password)   (tables + RLS)        (fetchPrice)
                            │
                            ▼
                      Resend (email alerts)
```

### Layer Responsibilities

| Layer | Responsibilities | Forbidden |
|-------|------------------|-----------|
| Frontend | URL input, display prices/history, wishlist UI, notifications UI | Scraping, pricing logic, ZenRows keys |
| API Routes | Auth, pipeline orchestration, DB writes, alert evaluation | Microservices, event buses |
| Provider | `fetchPrice(url)` → ZenRows | Business logic depending on ZenRows internals |
| Cron | Batch refresh every 6h | Per-request real-time scrape loops |

### Scheduling

- **Cron:** Vercel Cron → `POST /api/cron/refresh-prices` (validated via `CRON_SECRET`) → iterate eligible `tracked_products` → run pipeline in batches.
- **Manual:** `POST /api/products/[id]/refresh` → same pipeline; **15 minute cooldown** (returns 429 if violated).
- **Cost guard:** Skip if `last_fetched_at` is within 6 hours (cron) or 15 minutes (manual).

### Authentication

- Supabase Auth handles register/login/session.
- Next.js Middleware refreshes session; API routes use Supabase server client for `user.id`.
- PostgreSQL RLS: users read/write only their own rows.
- Cron route uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for batch updates.

---

## 2. Data Model

### Entity Relationships

```
auth.users (Supabase built-in)
 └── wishlist_items
      └── tracked_products
           ├── price_history[] (append-only)
           └── alert_logs (dedup + email tracking)
notifications (in-app, per user)
profiles (extends auth.users)
```

### Tables

#### `profiles`

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now()
);
```

Auto-inserted via trigger on `auth.users` signup.

#### `wishlist_items`

```sql
create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### `tracked_products`

```sql
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
```

#### `price_history` (append-only)

```sql
create table price_history (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  price numeric not null,
  currency text not null default 'USD',
  provider text not null default 'zenrows',
  created_at timestamptz default now()
);

create index idx_price_history_product_time
  on price_history (tracked_product_id, created_at desc);
```

#### `notifications`

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracked_product_id uuid references tracked_products(id) on delete set null,
  type text not null default 'price_alert',
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index idx_notifications_user_unread
  on notifications (user_id, created_at desc)
  where read_at is null;
```

#### `alert_logs`

```sql
create table alert_logs (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  price_history_id uuid not null references price_history(id),
  triggered_price numeric not null,
  target_price numeric not null,
  email_sent boolean default false,
  created_at timestamptz default now()
);
```

### RLS Summary

| Table | Policy |
|-------|--------|
| `profiles` | User reads/updates own row |
| `wishlist_items` | `user_id = auth.uid()` |
| `tracked_products` | `user_id = auth.uid()` |
| `price_history` | Via `tracked_products.user_id` join |
| `notifications` | `user_id = auth.uid()` |
| `alert_logs` | Via `tracked_products` join (read-only) |

### Modeling Rules

- Price data is never overwritten in `price_history`; only INSERT.
- URL is an attribute of `tracked_products`, not the entity itself.
- `WishlistItem` groups multiple `TrackedProducts`.
- `unique(user_id, url)` prevents duplicate tracking per user.
- `last_price` on `tracked_products` is a denormalized cache for list views.

---

## 3. API Endpoints & Pipeline

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| — | Supabase Auth | — | Register/login via Supabase client |
| `GET` | `/api/wishlists` | User | List wishlists with product counts |
| `POST` | `/api/wishlists` | User | Create wishlist `{ name }` |
| `PATCH` | `/api/wishlists/[id]` | User | Rename wishlist |
| `DELETE` | `/api/wishlists/[id]` | User | Delete wishlist (products ungrouped) |
| `GET` | `/api/products` | User | List tracked products |
| `POST` | `/api/products` | User | Add product; runs pipeline once |
| `GET` | `/api/products/[id]` | User | Product detail + price history |
| `PATCH` | `/api/products/[id]` | User | Update target_price, move group |
| `DELETE` | `/api/products/[id]` | User | Stop tracking |
| `POST` | `/api/products/[id]/refresh` | User | Manual refresh (15 min cooldown) |
| `GET` | `/api/notifications` | User | Notification list |
| `PATCH` | `/api/notifications/[id]/read` | User | Mark read |
| `POST` | `/api/notifications/read-all` | User | Mark all read |
| `POST` | `/api/cron/refresh-prices` | `CRON_SECRET` | Scheduled batch refresh |

### Pipeline: `runPricePipeline(trackedProductId)`

Shared by add-product, manual refresh, and cron.

1. **Input** — Load `tracked_product` (url, target_price, user_id).
2. **Fetch** — `provider.fetchPrice(url)` (ZenRows in provider layer only).
3. **Normalize** — `{ price, currency }`.
4. **Persist** — INSERT `price_history`; UPDATE `tracked_products.last_price`, `last_fetched_at`.
5. **Evaluate** — If `target_price IS NOT NULL AND price <= target_price`, check `alert_logs` for this `price_history` row.
6. **Notify** — INSERT `notifications`; send email via Resend; INSERT `alert_logs`; set `email_sent`.

### Provider Interface

```typescript
interface PriceProvider {
  fetchPrice(url: string): Promise<{ price: number; currency: string }>;
}
```

ZenRows implementation lives in `lib/providers/zenrows.ts`. Core services depend only on `PriceProvider`.

### Cron Logic

1. Validate `Authorization: Bearer ${CRON_SECRET}`.
2. Select products where `last_fetched_at IS NULL OR last_fetched_at < now() - interval '6 hours'`.
3. Process in batches of 20 to avoid timeout.
4. Call `runPricePipeline()` per product; log failures, continue batch.
5. Return `{ processed, succeeded, failed, skipped }`.

### Alert Rules

| Condition | Action |
|-----------|--------|
| `target_price` is null | Store history only, no alert |
| `price <= target_price` | In-app + email |
| Same `price_history` row | Alert once (dedup via `alert_logs`) |
| Price drops again after rising | New `price_history` row can trigger again |

### Logging

Structured logs with `correlationId` (`trackedProductId` + timestamp):

| Step | Fields |
|------|--------|
| Input | `correlationId`, `url`, `userId`, `trackedProductId` |
| Fetch | `correlationId`, `provider`, `durationMs` |
| Provider response | `correlationId`, `price`, `currency`, `status` |
| DB write | `correlationId`, `priceHistoryId`, `success` |
| Alert eval | `correlationId`, `targetPrice`, `currentPrice`, `triggered` |
| Notify | `correlationId`, `notificationId`, `emailSent` |

Do not log API keys or full raw HTML in production.

### Error Handling

| Error | HTTP | User-facing |
|-------|------|-------------|
| Unauthenticated | 401 | Redirect to login |
| Not owner | 403 | — |
| Duplicate URL | 409 | Already tracking |
| Cooldown active | 429 | Retry after N seconds |
| ZenRows failure | 502 | Cannot fetch price temporarily |
| Unparseable price | 422 | Cannot parse price from page |

---

## 4. Frontend

### Routes

| Path | Page | Auth |
|------|------|------|
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/` | Dashboard (all tracked products) | Required |
| `/wishlists` | Wishlist groups | Required |
| `/wishlists/[id]` | Products in group | Required |
| `/products/[id]` | Detail + price history chart | Required |
| `/notifications` | Notification center | Required |

### Page Responsibilities

- **Dashboard:** Add product form (URL, optional target price, optional group); product list with current/target price, last updated, refresh, edit, delete; highlight when target met.
- **Wishlists:** CRUD groups; navigate to group detail.
- **Product detail:** URL, title, editable target price, price history chart/table, manual refresh.
- **Notifications:** Unread badge in nav; list with mark read / mark all read.

### Frontend Constraints

- Calls own `/api/*` only — never ZenRows.
- Displays API-returned prices; no client-side alert evaluation.
- URL format validation only; no scraping or HTML parsing.

### UI Stack

- Tailwind CSS + shadcn/ui
- `recharts` for price history chart on detail page
- Server Components for initial load; client `fetch` for interactions
- Desktop-first; mobile stacks to single column

---

## 5. Project Structure & Deployment

### Directory Layout

```
price-watch/
├── app/
│   ├── (auth)/login, register
│   ├── (dashboard)/layout, page, wishlists, products, notifications
│   └── api/wishlists, products, notifications, cron
├── lib/
│   ├── supabase/ (client, server, middleware helpers)
│   ├── providers/ (price-provider.ts, zenrows.ts)
│   ├── pipeline/run-price-pipeline.ts
│   └── email/send-alert.ts
├── components/
├── supabase/migrations/
├── middleware.ts
└── vercel.json
```

### Environment Variables

| Variable | Purpose | Client-exposed |
|----------|---------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron batch ops | No |
| `ZENROWS_API_KEY` | Price fetching | No |
| `RESEND_API_KEY` | Email | No |
| `RESEND_FROM_EMAIL` | Sender address | No |
| `CRON_SECRET` | Protect cron endpoint | No |

### Deployment

| Component | Platform |
|-----------|----------|
| Next.js app | Vercel |
| PostgreSQL + Auth | Supabase |
| Cron | Vercel Cron (`0 */6 * * *` UTC) |
| Email | Resend |
| Scraping | ZenRows |

### Testing (MVP)

- Manual E2E: register → add URL → see price → set target → verify alert on price drop.
- Optional unit tests: pipeline alert logic, price normalization.
- Optional integration tests: API routes with mocked provider.

---

## Success Criteria

- [ ] Valid product URL can be added
- [ ] Price fetched via ZenRows (through provider abstraction)
- [ ] Data stored and retrievable (append-only history)
- [ ] Target price triggers in-app + email alert
- [ ] System remains simple and maintainable (3-layer, no microservices)
