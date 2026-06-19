import {
  isAmazonProductUrl,
  MAX_RETRIES,
  priceUpdateEndpoint,
  randomDelayMs,
  TAB_LOAD_TIMEOUT_MS,
} from "./config.js";
import {
  addWishlistItem,
  getAccessToken,
  getRefreshSession,
  getWishlist,
  removeWishlistItem,
  setRefreshSession,
  updateWishlistItem,
} from "./storage.js";

const MESSAGE = {
  ADD_CURRENT_TAB: "ADD_CURRENT_TAB",
  REFRESH_ALL: "REFRESH_ALL",
  GET_WISHLIST: "GET_WISHLIST",
  REMOVE_ITEM: "REMOVE_ITEM",
  REFRESH_PROGRESS: "REFRESH_PROGRESS",
};

/** @param {unknown} payload */
async function broadcastProgress(payload) {
  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE.REFRESH_PROGRESS,
      ...payload,
    });
  } catch {
    // Popup may be closed — progress is also persisted in storage.
  }
}

/** @param {number} tabId */
function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for page load."));
    }, TAB_LOAD_TIMEOUT_MS);

    /** @param {number} updatedTabId */
    /** @param {chrome.tabs.TabChangeInfo} changeInfo */
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timeoutId);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

/** @param {number} tabId */
async function ensureContentScript(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PRODUCT" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PRODUCT" });
  }
}

/**
 * @param {{ url: string; title: string; price: string; asin: string; timestamp: number }} data
 */
async function postPriceUpdate(data) {
  const accessToken = await getAccessToken();
  const headers = { "Content-Type": "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(priceUpdateEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: data.url,
      title: data.title,
      price: data.price,
      asin: data.asin,
      timestamp: data.timestamp,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 401) {
      throw new Error(
        "Backend unauthorized. Add your API token in the extension settings."
      );
    }
    throw new Error(`Backend returned ${response.status}${body ? `: ${body}` : ""}`);
  }
}

/** @returns {Promise<number>} */
async function getOrCreateWorkerTab(existingTabId) {
  if (existingTabId) {
    try {
      const tab = await chrome.tabs.get(existingTabId);
      if (tab?.id) {
        return tab.id;
      }
    } catch {
      // Tab was closed — create a new one below.
    }
  }

  const tab = await chrome.tabs.create({
    url: "about:blank",
    active: false,
  });

  if (!tab.id) {
    throw new Error("Failed to create worker tab.");
  }

  return tab.id;
}

/**
 * @param {string} url
 * @param {number} tabId
 */
async function refreshSingleItem(url, tabId) {
  let lastError = "Unknown error.";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await chrome.tabs.update(tabId, { url, active: false });
      await waitForTabComplete(tabId);
      await new Promise((resolve) => setTimeout(resolve, 800));

      const extraction = await ensureContentScript(tabId);
      if (!extraction?.ok || !extraction.data) {
        throw new Error(extraction?.error ?? "Failed to extract product data.");
      }

      const { data } = extraction;
      if (!data.title && !data.price) {
        throw new Error("Extracted data is missing title and price.");
      }

      await postPriceUpdate(data);

      await updateWishlistItem(url, {
        title: data.title,
        price: data.price,
        asin: data.asin,
        lastUpdated: data.timestamp,
        lastStatus: "success",
        lastError: undefined,
      });

      return { ok: true, data };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, randomDelayMs()));
      }
    }
  }

  await updateWishlistItem(url, {
    lastStatus: "error",
    lastError,
    lastUpdated: Date.now(),
  });

  return { ok: false, error: lastError };
}

async function runRefreshAll() {
  const session = await getRefreshSession();
  if (session.active) {
    return { ok: false, error: "A refresh is already in progress." };
  }

  const wishlist = await getWishlist();
  const items = wishlist.items.slice(0, 10);

  if (items.length === 0) {
    return { ok: false, error: "Wishlist is empty." };
  }

  let workerTabId;
  try {
    workerTabId = await getOrCreateWorkerTab(session.workerTabId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to open worker tab.";
    return { ok: false, error: message };
  }

  await setRefreshSession({
    active: true,
    currentIndex: 0,
    total: items.length,
    workerTabId,
  });

  try {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];

      await setRefreshSession({
        active: true,
        currentIndex: index,
        total: items.length,
        workerTabId,
      });

      await updateWishlistItem(item.url, { lastStatus: "pending", lastError: undefined });

      await broadcastProgress({
        currentIndex: index,
        total: items.length,
        url: item.url,
        phase: "processing",
      });

      const result = await refreshSingleItem(item.url, workerTabId);

      await broadcastProgress({
        currentIndex: index,
        total: items.length,
        url: item.url,
        phase: "done",
        ok: result.ok,
        error: result.error,
      });

      if (index < items.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, randomDelayMs()));
      }
    }

    return { ok: true };
  } finally {
    await setRefreshSession({
      active: false,
      currentIndex: items.length,
      total: items.length,
      workerTabId,
    });

    await broadcastProgress({
      currentIndex: items.length,
      total: items.length,
      phase: "complete",
    });
  }
}

async function addCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;

  if (!url) {
    return { ok: false, error: "Could not read the current tab URL." };
  }

  if (!isAmazonProductUrl(url)) {
    return {
      ok: false,
      error: "Current page is not a supported Amazon product URL.",
    };
  }

  return addWishlistItem(url);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case MESSAGE.GET_WISHLIST: {
        const wishlist = await getWishlist();
        const session = await getRefreshSession();
        sendResponse({ ok: true, wishlist, session });
        break;
      }
      case MESSAGE.ADD_CURRENT_TAB: {
        sendResponse(await addCurrentTab());
        break;
      }
      case MESSAGE.REMOVE_ITEM: {
        if (!message.url || typeof message.url !== "string") {
          sendResponse({ ok: false, error: "url is required." });
          break;
        }
        sendResponse(await removeWishlistItem(message.url));
        break;
      }
      case MESSAGE.REFRESH_ALL: {
        sendResponse(await runRefreshAll());
        break;
      }
      default:
        sendResponse({ ok: false, error: "Unknown message type." });
    }
  })();

  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" && areaName !== "session") {
    return;
  }
  if (changes.wishlist || changes.refreshSession) {
    broadcastProgress({ phase: "storage" }).catch(() => {});
  }
});
