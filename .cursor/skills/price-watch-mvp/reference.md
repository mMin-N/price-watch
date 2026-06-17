# Price Watch MVP — Reference

## Entity Relationships

```
User
 └── WishlistItem (logical grouping, e.g. "Holiday gifts")
      └── TrackedProduct (one URL per tracked item)
           └── PriceHistory[] (append-only snapshots)
```

- `TrackedProduct` holds: URL, target price, last-checked timestamp, provider metadata (optional).
- `PriceHistory` holds: price, currency, fetched_at, provider id — never update in place; always insert.
- Same product URL may map to one `TrackedProduct`; wishlist grouping is via `WishlistItem`.

## Provider Interface

Keep provider logic in a dedicated module. Core services depend only on the interface.

```typescript
// providers/price-provider.ts
export interface PriceFetchResult {
  price: number;
  currency: string;
  rawResponse?: unknown; // for debug logs only
}

export interface PriceProvider {
  fetchPrice(url: string): Promise<PriceFetchResult>;
}
```

```typescript
// providers/zenrows-provider.ts — provider-specific; NOT imported by core business logic
export class ZenRowsProvider implements PriceProvider {
  async fetchPrice(url: string): Promise<PriceFetchResult> {
    // ZenRows API call here
  }
}
```

Core service usage:

```typescript
async function trackPrice(url: string, provider: PriceProvider) {
  const result = await provider.fetchPrice(url);
  // normalize → persist PriceHistory → evaluate alert
}
```

## Pipeline Logging Template

Log at each step with a correlation id (e.g. `trackedProductId` or request id):

| Step | Log fields |
|------|------------|
| Input | `url`, `userId`, `trackedProductId` |
| Fetch | `url`, `provider`, `durationMs` |
| Provider response | `price`, `currency`, `status` (avoid logging full secrets) |
| DB write | `priceHistoryId`, `trackedProductId`, `success` |
| Alert | `trackedProductId`, `targetPrice`, `currentPrice`, `triggered` |

## Allowed vs Forbidden — Quick Reference

| Area | Allowed | Forbidden |
|------|---------|-----------|
| Backend | REST, stateless handlers, direct ORM/DB | Microservices, Kafka, saga orchestration |
| Updates | Cron, scheduled job, user "refresh" button | Scrape on every page view |
| Frontend | URL input, display prices, wishlist UI | ZenRows keys, scrape calls, alert rules |
| Data | Append-only PriceHistory | Overwriting historical prices |
