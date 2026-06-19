# Currency Conversion — Design Spec

**Date:** 2026-06-17  
**Status:** Draft (pending review)  
**Parent:** `docs/superpowers/specs/2026-06-17-price-watch-design.md`  
**Skill:** `.cursor/skills/price-watch-mvp/SKILL.md`

## Summary

Add real currency conversion in the price pipeline so fetched prices in any supported currency are normalized to **USD** before persistence, alert evaluation, and display. Replace the current `normalizeToUsd` stub that only relabels `currency` without converting `price`.

**User decision:** Option **A** — unify storage and comparison to USD (minimal scope).

**Library choice:** **cashify** (conversion math) + **Frankfurter API** via thin `ExchangeRateProvider` (rate fetching). No API key required.

## Problem

`lib/providers/normalize-price.ts` currently sets `currency: "USD"` while leaving `price` unchanged. If ZenRows returns EUR or GBP, alerts and history store wrong values.

## Goals

- Convert fetched `{ price, currency }` to USD in pipeline step 3 (Normalize).
- Keep `price_history` append-only; all stored amounts in USD after this change.
- Preserve original fetch currency in logs for debugging (not required in DB for MVP).
- Alert evaluation continues to compare USD `price` vs USD `target_price` — no schema change.
- Exchange rate provider is replaceable (same pattern as `PriceProvider`).

## Non-Goals

- User-selectable display currency (`profiles.preferred_currency`) — deferred.
- Storing original currency per `price_history` row — deferred (all USD for MVP).
- Real-time exchange rates (Frankfurter ECB data updates daily).
- Crypto or exotic currencies beyond Frankfurter coverage (~30 fiat currencies).

## Architecture

```
fetchPrice(url) → { price, currency }   // e.g. EUR 89.99
       ↓
ExchangeRateProvider.getRates()           // cached Frankfurter rates, base EUR
       ↓
convertToUsd(price, currency, rates)      // cashify
       ↓
{ price: 97.42, currency: "USD" }
       ↓
persistPriceSnapshot / evaluateAlert      // unchanged contract
```

### New modules

| File | Responsibility |
|------|----------------|
| `lib/currency/exchange-rate-provider.ts` | Interface: `getRates(): Promise<RatesTable>` |
| `lib/providers/frankfurter.ts` | Fetches latest rates from `https://api.frankfurter.dev/v2/latest?base=EUR` |
| `lib/currency/rate-cache.ts` | In-memory cache with 24h TTL; single shared instance |
| `lib/currency/convert.ts` | `convertToUsd(amount, fromCurrency, rates)` using cashify |
| `lib/providers/normalize-price.ts` | Replace stub with async `normalizeToUsd(result, rates)` |

### Provider interface

```typescript
export type RatesTable = Record<string, number>;

export interface ExchangeRateProvider {
  /** Returns rates with a single base (Frankfurter default: EUR). */
  getRates(): Promise<{ base: string; rates: RatesTable }>;
}
```

### Conversion

```typescript
import { Cashify } from "cashify";

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: RatesTable,
  base: string
): number {
  const cashify = new Cashify({ base, rates });
  return cashify.convert(amount, { from, to });
}
```

USD normalization: if `from === "USD"`, return amount unchanged. If `from` missing from rates, throw `UnsupportedCurrencyError`.

### Caching

- Module-level cache in `rate-cache.ts`.
- TTL: **24 hours** (Frankfurter ECB rates update on business days).
- On cache miss or expiry: fetch once per process; concurrent requests share one in-flight promise.
- Cron batch (many products): first product warms cache; rest reuse.

### Pipeline change

`runPricePipeline` becomes:

1. Load product (unchanged).
2. `fetchResult = await provider.fetchPrice(url)`.
3. `rates = await getCachedRates(exchangeRateProvider)`.
4. `normalized = normalizeToUsd(fetchResult, rates)` — async.
5. `persistPriceSnapshot(..., normalized, ...)`.

Log `step: "normalize"` with `originalPrice`, `originalCurrency`, `convertedPrice`, `rateBase`.

### Error handling

| Case | Behavior |
|------|----------|
| `from === "USD"` | Skip conversion |
| Frankfurter unreachable | Retry once; then fail pipeline with 502-equivalent error |
| Unknown currency code | Fail with 422 "Unsupported currency: XXX" |
| Same-currency non-USD already USD path | N/A |

Alert is **not** triggered on conversion failure — pipeline throws before persist.

### Dependencies

```bash
npm install cashify
```

Frankfurter: direct `fetch` (no extra package; avoid immature `frankfurter-js` for MVP).

### Environment variables

None required for Frankfurter (no API key).

Optional future: `EXCHANGE_RATE_PROVIDER=frankfurter` for provider swap.

## Data model

**No migration required.** All `currency` columns remain; values will genuinely be USD after normalization.

`tracked_products.target_price` and `baseline_price` are already assumed USD in the UI.

## Testing

| Test | File |
|------|------|
| USD passthrough (no conversion) | `lib/currency/convert.test.ts` |
| EUR → USD with mock rates | `lib/currency/convert.test.ts` |
| Unsupported currency throws | `lib/currency/convert.test.ts` |
| `normalizeToUsd` integration with mock rates | `lib/providers/normalize-price.test.ts` |
| Cache returns same object within TTL | `lib/currency/rate-cache.test.ts` |

Mock Frankfurter responses in tests; no live API calls in CI.

## Logging

Add to existing structured logs:

```json
{
  "step": "normalize",
  "correlationId": "...",
  "originalPrice": 89.99,
  "originalCurrency": "EUR",
  "convertedPrice": 97.42,
  "currency": "USD"
}
```

## Success criteria

- [ ] EUR product fetched via ZenRows stores correct USD amount in `price_history`.
- [ ] USD product passes through without double conversion.
- [ ] Alert fires when converted USD price meets USD target.
- [ ] Frankfurter outage surfaces clear error; no silent wrong prices.
- [ ] Exchange rate logic isolated behind `ExchangeRateProvider`.

## Rollout

1. Implement modules + tests.
2. Wire into `runPricePipeline`.
3. Manual E2E: add non-USD Amazon URL (e.g. amazon.co.uk) and verify USD storage.
