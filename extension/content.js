/**
 * Extract product data from the current Amazon product page DOM.
 * @returns {{ url: string; title: string; price: string; asin: string; timestamp: number }}
 */
function extractProductData() {
  const titleSelectors = [
    "#productTitle",
    "#title",
    "h1#title",
    "span#productTitle",
    "#btAsinTitle",
    "#ebooksProductTitle",
  ];

  const priceSelectors = [
    ".a-price .a-offscreen",
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
    "#corePrice_feature_div .a-price .a-offscreen",
    ".priceToPay .a-offscreen",
    "#tp_price_block_total_price_ww .a-offscreen",
    "#newBuyBoxPrice",
    "#kindle-price",
    ".a-color-price",
  ];

  let title = "";
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();
    if (text) {
      title = text;
      break;
    }
  }

  let price = "";
  for (const selector of priceSelectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();
    if (text) {
      price = text;
      break;
    }
  }

  let asin = "";
  const asinInput = document.querySelector('input[name="ASIN"]');
  if (asinInput instanceof HTMLInputElement && asinInput.value) {
    asin = asinInput.value.trim().toUpperCase();
  } else {
    const dataAsin = document.querySelector("[data-asin]");
    const dataValue = dataAsin?.getAttribute("data-asin");
    if (dataValue && /^[A-Z0-9]{10}$/i.test(dataValue)) {
      asin = dataValue.toUpperCase();
    } else {
      const match = window.location.pathname.match(
        /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i
      );
      if (match) {
        asin = match[1].toUpperCase();
      }
    }
  }

  return {
    url: window.location.href,
    title,
    price,
    asin,
    timestamp: Date.now(),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_PRODUCT") {
    return;
  }

  (async () => {
    try {
      const data = extractProductData();
      if (!data.title && !data.price) {
        sendResponse({
          ok: false,
          error: "Could not find product title or price on this page.",
          data,
        });
        return;
      }
      sendResponse({ ok: true, data });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Extraction failed.";
      sendResponse({ ok: false, error: errorMessage });
    }
  })();

  return true;
});
