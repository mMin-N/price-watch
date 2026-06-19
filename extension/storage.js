import { MAX_WISHLIST_ITEMS, normalizeWishlistUrl } from "./config.js";

const WISHLIST_KEY = "wishlist";
const SESSION_KEY = "refreshSession";
const ACCESS_TOKEN_KEY = "accessToken";

/** @typedef {{ url: string; title?: string; price?: string; asin?: string; lastUpdated?: number; lastStatus?: string; lastError?: string }} WishlistItem */

/** @typedef {{ items: WishlistItem[] }} WishlistState */

/** @typedef {{ active: boolean; currentIndex: number; total: number; workerTabId?: number }} RefreshSession */

/** @returns {Promise<WishlistState>} */
export async function getWishlist() {
  const result = await chrome.storage.local.get(WISHLIST_KEY);
  const state = result[WISHLIST_KEY];
  if (!state || !Array.isArray(state.items)) {
    return { items: [] };
  }
  return { items: state.items };
}

/** @param {WishlistState} state */
export async function setWishlist(state) {
  await chrome.storage.local.set({ [WISHLIST_KEY]: state });
}

/** @returns {Promise<RefreshSession>} */
export async function getRefreshSession() {
  const result = await chrome.storage.session.get(SESSION_KEY);
  return (
    result[SESSION_KEY] ?? {
      active: false,
      currentIndex: 0,
      total: 0,
    }
  );
}

/** @param {RefreshSession} session */
export async function setRefreshSession(session) {
  await chrome.storage.session.set({ [SESSION_KEY]: session });
}

/** @param {string} url */
export async function addWishlistItem(url) {
  const normalized = normalizeWishlistUrl(url);
  const wishlist = await getWishlist();

  if (wishlist.items.length >= MAX_WISHLIST_ITEMS) {
    return { ok: false, error: `Wishlist is full (max ${MAX_WISHLIST_ITEMS} items).` };
  }

  const duplicate = wishlist.items.some(
    (item) => normalizeWishlistUrl(item.url) === normalized
  );
  if (duplicate) {
    return { ok: false, error: "This product is already in your wishlist." };
  }

  wishlist.items.push({
    url: normalized,
    lastStatus: "idle",
  });

  await setWishlist(wishlist);
  return { ok: true, item: wishlist.items[wishlist.items.length - 1] };
}

/** @param {string} url */
export async function removeWishlistItem(url) {
  const normalized = normalizeWishlistUrl(url);
  const wishlist = await getWishlist();
  const nextItems = wishlist.items.filter(
    (item) => normalizeWishlistUrl(item.url) !== normalized
  );

  if (nextItems.length === wishlist.items.length) {
    return { ok: false, error: "Item not found." };
  }

  await setWishlist({ items: nextItems });
  return { ok: true };
}

/**
 * @param {string} url
 * @param {Partial<WishlistItem>} patch
 */
export async function updateWishlistItem(url, patch) {
  const normalized = normalizeWishlistUrl(url);
  const wishlist = await getWishlist();
  const index = wishlist.items.findIndex(
    (item) => normalizeWishlistUrl(item.url) === normalized
  );

  if (index === -1) {
    return { ok: false, error: "Item not found." };
  }

  wishlist.items[index] = { ...wishlist.items[index], ...patch };
  await setWishlist(wishlist);
  return { ok: true, item: wishlist.items[index] };
}

/** @returns {Promise<string | null>} */
export async function getAccessToken() {
  const result = await chrome.storage.local.get(ACCESS_TOKEN_KEY);
  const token = result[ACCESS_TOKEN_KEY];
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

/** @param {string | null} token */
export async function setAccessToken(token) {
  if (!token || !token.trim()) {
    await chrome.storage.local.remove(ACCESS_TOKEN_KEY);
    return;
  }
  await chrome.storage.local.set({ [ACCESS_TOKEN_KEY]: token.trim() });
}
