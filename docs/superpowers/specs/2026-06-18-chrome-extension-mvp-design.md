# Chrome Extension MVP — Price Watch Wishlist

**Date:** 2026-06-18  
**Status:** Approved (brainstorming — requirements provided in full)  
**Parent:** `docs/superpowers/specs/2026-06-17-price-watch-design.md`

## Summary

Manifest V3 Chrome extension for Amazon product pages. Users save up to 10 product URLs locally, refresh prices sequentially via DOM extraction (no scraping API), and POST results to `POST {BACKEND_URL}/api/price-update`.

## Decisions

| Item | Decision |
|------|----------|
| Storage | `chrome.storage.local` — wishlist URLs + last fetch metadata |
| Refresh strategy | **Single reusable background tab**, navigate sequentially (Approach A) |
| Extraction | Content script on Amazon pages; `tabs.sendMessage` with `executeScript` fallback |
| Concurrency | Strictly sequential; 500–1000 ms delay between items; max 1 active worker tab |
| Retries | Up to 2 retries per URL on extraction/network failure |
| SW state | `chrome.storage.session` for refresh queue (no in-memory globals) |
| Backend | Configurable `BACKEND_URL`; MVP calls `/api/price-update` without auth |
| Tech | Vanilla JS, ES modules in SW/popup; no React |

## Approaches Considered

1. **Single background tab (chosen)** — Open one inactive tab, navigate URL-by-URL. Low memory, stable, meets “max 1–2 tabs” constraint.
2. **Parallel tabs** — Faster but violates constraints and risks Amazon rate limits / browser load.
3. **`executeScript` only (no persistent tab)** — Possible but awkward for sequential multi-URL batch; navigation still needs a tab.

## Architecture

```
popup.html/popup.js
    │  add / refresh / display progress
    ▼
background.js (service worker)
    │  sequential queue, retries, POST backend
    ├── chrome.tabs (1 worker tab)
    └── content.js (Amazon DOM extract)
storage.js
    └── chrome.storage.local (wishlist, max 10)
```

## Data Model (local)

```typescript
type WishlistItem = {
  url: string;
  title?: string;
  price?: string;
  asin?: string;
  lastUpdated?: number;
  lastStatus?: 'idle' | 'pending' | 'success' | 'error';
  lastError?: string;
};

type WishlistState = {
  items: WishlistItem[]; // max 10
};
```

Session state (`chrome.storage.session`):

```typescript
type RefreshSession = {
  active: boolean;
  currentIndex: number;
  total: number;
  workerTabId?: number;
};
```

## Message Protocol

| Type | Direction | Purpose |
|------|-----------|---------|
| `ADD_CURRENT_TAB` | popup → background | Add active tab URL if Amazon product page |
| `REFRESH_ALL` | popup → background | Start batch refresh |
| `GET_WISHLIST` | popup → background | Return items + refresh session |
| `REMOVE_ITEM` | popup → background | Remove URL from wishlist |
| `REFRESH_PROGRESS` | background → popup | Broadcast index/status updates |
| `EXTRACT_PRODUCT` | background → content | Return `{ url, title, price, asin, timestamp }` |

## Backend Payload

```json
POST {BACKEND_URL}/api/price-update
{
  "url": "string",
  "title": "string",
  "price": "string",
  "asin": "string",
  "timestamp": 1234567890
}
```

Backend implementation is out of scope; extension logs non-2xx responses and marks item as error.

## Error Handling

- Non-Amazon URL on add → user-visible error in popup
- Duplicate URL → rejected with message
- Extraction failure → retry up to 2 times, then `lastStatus: error`
- Backend POST failure → item marked error; batch continues
- Refresh already running → second click ignored

## File Layout

```
extension/
  manifest.json
  config.js
  storage.js
  content.js
  background.js
  popup.html
  popup.css
  popup.js
```

## Non-Goals

- Auth integration with Price Watch web app
- Non-Amazon marketplaces
- Sync wishlist to server
- Chrome Web Store packaging (icons omitted per MVP)

## Success Criteria

- Add current Amazon product page to wishlist (deduped, max 10)
- Refresh all sequentially with visible progress
- Extract title, price, ASIN from DOM
- POST to configured backend endpoint
- Popup remains responsive during batch
