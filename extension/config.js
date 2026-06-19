/** @typedef {{ url: string; title?: string; price?: string; asin?: string; lastUpdated?: number; lastStatus?: string; lastError?: string }} WishlistItem */

export const MAX_WISHLIST_ITEMS = 10;

/** Minimum delay between refresh requests (ms). */
export const REFRESH_DELAY_MIN_MS = 500;

/** Maximum delay between refresh requests (ms). */
export const REFRESH_DELAY_MAX_MS = 1000;

/** Max retry attempts per URL after the first try. */
export const MAX_RETRIES = 2;

/** Tab load timeout (ms). */
export const TAB_LOAD_TIMEOUT_MS = 45000;

/**
 * Backend base URL — no trailing slash.
 * Update this and matching host_permissions in manifest.json for production.
 */
export const BACKEND_URL = "http://localhost:3000";

export const PRICE_UPDATE_PATH = "/api/price-update";

export function priceUpdateEndpoint() {
  return `${BACKEND_URL}${PRICE_UPDATE_PATH}`;
}

/** Amazon product page URL pattern (www.amazon.<tld>/.../dp/ASIN or /gp/product/ASIN). */
export function isAmazonProductUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/^www\.amazon\./i.test(parsed.hostname)) {
      return false;
    }
    return /\/(?:dp|gp\/product)\/[A-Z0-9]{10}/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function normalizeWishlistUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
}

export function randomDelayMs() {
  return (
    REFRESH_DELAY_MIN_MS +
    Math.floor(Math.random() * (REFRESH_DELAY_MAX_MS - REFRESH_DELAY_MIN_MS + 1))
  );
}
