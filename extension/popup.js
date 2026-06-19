import { BACKEND_URL } from "./config.js";
import { getAccessToken, setAccessToken } from "./storage.js";

const MESSAGE = {
  ADD_CURRENT_TAB: "ADD_CURRENT_TAB",
  REFRESH_ALL: "REFRESH_ALL",
  GET_WISHLIST: "GET_WISHLIST",
  REMOVE_ITEM: "REMOVE_ITEM",
  REFRESH_PROGRESS: "REFRESH_PROGRESS",
};

const addBtn = document.getElementById("add-btn");
const refreshBtn = document.getElementById("refresh-btn");
const wishlistEl = document.getElementById("wishlist");
const emptyStateEl = document.getElementById("empty-state");
const statusBannerEl = document.getElementById("status-banner");
const progressEl = document.getElementById("progress");
const progressFillEl = document.getElementById("progress-fill");
const progressTextEl = document.getElementById("progress-text");
const tokenInputEl = document.getElementById("token-input");
const saveTokenBtn = document.getElementById("save-token-btn");
const connectLinkEl = document.getElementById("connect-link");

/** @type {ReturnType<typeof setTimeout> | null} */
let statusTimeoutId = null;

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "Never updated";
  }
  return `Updated ${new Date(timestamp).toLocaleString()}`;
}

function truncateUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 36 ? `${parsed.pathname.slice(0, 36)}…` : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url;
  }
}

/**
 * @param {string} message
 * @param {"info" | "error" | "success"} kind
 */
function showStatus(message, kind = "info") {
  if (!statusBannerEl) {
    return;
  }

  statusBannerEl.textContent = message;
  statusBannerEl.className = `status-banner ${kind}`;
  statusBannerEl.classList.remove("hidden");

  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
  }

  statusTimeoutId = setTimeout(() => {
    statusBannerEl.classList.add("hidden");
  }, 4000);
}

/**
 * @param {{ active?: boolean; currentIndex?: number; total?: number }} session
 */
function updateProgressUi(session) {
  if (!progressEl || !progressFillEl || !progressTextEl) {
    return;
  }

  if (!session?.active) {
    progressEl.classList.add("hidden");
    progressFillEl.style.width = "0%";
    progressTextEl.textContent = "";
    return;
  }

  const total = session.total || 1;
  const current = Math.min(session.currentIndex ?? 0, total);
  const percent = Math.round((current / total) * 100);

  progressEl.classList.remove("hidden");
  progressFillEl.style.width = `${percent}%`;
  progressTextEl.textContent = `Refreshing ${current + 1} of ${total}…`;
}

/**
 * @param {Array<{ url: string; title?: string; price?: string; lastUpdated?: number; lastStatus?: string; lastError?: string }>} items
 */
function renderWishlist(items) {
  if (!wishlistEl || !emptyStateEl) {
    return;
  }

  wishlistEl.innerHTML = "";

  if (!items.length) {
    emptyStateEl.classList.remove("hidden");
    return;
  }

  emptyStateEl.classList.add("hidden");

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "wishlist-item";

    const main = document.createElement("div");
    main.className = "item-main";

    const title = document.createElement("p");
    title.className = "item-title";
    title.textContent = item.title || "Untitled product";

    const url = document.createElement("p");
    url.className = "item-url";
    url.textContent = truncateUrl(item.url);
    url.title = item.url;

    const meta = document.createElement("p");
    meta.className = "item-meta";
    const priceSpan = document.createElement("span");
    priceSpan.className = "item-price";
    priceSpan.textContent = item.price ? `${item.price} · ` : "";
    meta.appendChild(priceSpan);
    meta.appendChild(document.createTextNode(formatTimestamp(item.lastUpdated)));

    if (item.lastStatus === "error" && item.lastError) {
      const err = document.createElement("span");
      err.textContent = ` · ${item.lastError}`;
      err.style.color = "var(--error)";
      meta.appendChild(err);
    }

    main.appendChild(title);
    main.appendChild(url);
    main.appendChild(meta);

    const status = document.createElement("span");
    status.className = `item-status ${item.lastStatus || "idle"}`;
    status.textContent = item.lastStatus || "idle";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "item-remove";
    removeBtn.setAttribute("aria-label", "Remove item");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", async () => {
      removeBtn.disabled = true;
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE.REMOVE_ITEM,
        url: item.url,
      });
      if (!response?.ok) {
        showStatus(response?.error ?? "Failed to remove item.", "error");
      }
      await loadWishlist();
    });

    li.appendChild(main);
    li.appendChild(status);
    li.appendChild(removeBtn);
    wishlistEl.appendChild(li);
  }
}

async function loadWishlist() {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE.GET_WISHLIST });
  if (!response?.ok) {
    showStatus("Failed to load wishlist.", "error");
    return;
  }

  renderWishlist(response.wishlist?.items ?? []);
  updateProgressUi(response.session);
  setButtonsDisabled(Boolean(response.session?.active));
}

function setButtonsDisabled(refreshing) {
  if (addBtn) {
    addBtn.disabled = refreshing;
  }
  if (refreshBtn) {
    refreshBtn.disabled = refreshing;
  }
}

if (addBtn) {
  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true;
    const response = await chrome.runtime.sendMessage({ type: MESSAGE.ADD_CURRENT_TAB });
    if (response?.ok) {
      showStatus("Added to wishlist.", "success");
    } else {
      showStatus(response?.error ?? "Could not add page.", "error");
    }
    await loadWishlist();
    addBtn.disabled = false;
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", async () => {
    setButtonsDisabled(true);
    progressEl?.classList.remove("hidden");

    const response = await chrome.runtime.sendMessage({ type: MESSAGE.REFRESH_ALL });

    if (!response?.ok) {
      showStatus(response?.error ?? "Refresh failed to start.", "error");
      setButtonsDisabled(false);
      await loadWishlist();
      return;
    }

    showStatus("Refresh started.", "info");
    await loadWishlist();
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== MESSAGE.REFRESH_PROGRESS) {
    return;
  }

  if (message.phase === "processing" || message.phase === "done") {
    updateProgressUi({
      active: true,
      currentIndex: message.currentIndex,
      total: message.total,
    });
  }

  if (message.phase === "complete") {
    showStatus("Refresh complete.", "success");
    setButtonsDisabled(false);
  }

  loadWishlist();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.wishlist) {
    loadWishlist();
  }
  if (areaName === "session" && changes.refreshSession) {
    loadWishlist();
  }
});

if (connectLinkEl instanceof HTMLAnchorElement) {
  connectLinkEl.href = `${BACKEND_URL}/extension`;
}

async function loadTokenField() {
  const token = await getAccessToken();
  if (tokenInputEl instanceof HTMLInputElement) {
    tokenInputEl.value = token ?? "";
  }
}

if (saveTokenBtn && tokenInputEl instanceof HTMLInputElement) {
  saveTokenBtn.addEventListener("click", async () => {
    await setAccessToken(tokenInputEl.value);
    showStatus("API token saved.", "success");
  });
}

await loadTokenField();
await loadWishlist();
