import { detectOutOfStock, parseUsdPrice, type SiteParseResult } from "./shared";

const OUT_OF_STOCK_PATTERNS = [
  /this listing has ended/i,
  /out of stock/i,
  /no longer available/i,
  /"availability"\s*:\s*"https:\/\/schema\.org\/OutOfStock"/i,
];

function parseEbayJsonLd(html: string): SiteParseResult | null {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of scripts) {
    try {
      const data = JSON.parse(match[1]);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const offers = node?.offers;
        const offer = Array.isArray(offers) ? offers[0] : offers;
        const rawPrice = offer?.price ?? offer?.lowPrice ?? node?.price;
        if (rawPrice === undefined || rawPrice === null) continue;
        const price = parseUsdPrice(String(rawPrice));
        if (!price) continue;
        const currency = offer?.priceCurrency ?? "USD";
        const availability = String(offer?.availability ?? "");
        const isAvailable = !availability.includes("OutOfStock");
        return {
          price,
          currency,
          title: typeof node?.name === "string" ? node.name : undefined,
          isAvailable,
        };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function parseEbayPage(html: string): SiteParseResult | null {
  const jsonLd = parseEbayJsonLd(html);
  if (jsonLd) {
    if (detectOutOfStock(html, OUT_OF_STOCK_PATTERNS)) {
      return { ...jsonLd, isAvailable: false };
    }
    return jsonLd;
  }

  const primaryPrice = html.match(
    /data-testid="x-price-primary"[^>]*>[\s\S]*?>\s*\$?\s*([\d,]+\.?\d*)/i
  );
  if (primaryPrice) {
    const price = parseUsdPrice(primaryPrice[1]);
    if (price) {
      return {
        price,
        currency: "USD",
        isAvailable: !detectOutOfStock(html, OUT_OF_STOCK_PATTERNS),
      };
    }
  }

  const itempropPrice = html.match(/itemprop="price"\s+content="([\d.]+)"/i);
  if (itempropPrice) {
    const price = parseUsdPrice(itempropPrice[1]);
    if (price) {
      const currencyMatch = html.match(/itemprop="priceCurrency"\s+content="([A-Z]{3})"/i);
      return {
        price,
        currency: currencyMatch?.[1] ?? "USD",
        isAvailable: !detectOutOfStock(html, OUT_OF_STOCK_PATTERNS),
      };
    }
  }

  return null;
}
