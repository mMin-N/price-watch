import { detectOutOfStock, parseInrPrice, type SiteParseResult } from "./shared";

const OUT_OF_STOCK_PATTERNS = [
  /currently unavailable/i,
  /sold out/i,
  /out of stock/i,
  /"availability"\s*:\s*"https:\/\/schema\.org\/OutOfStock"/i,
];

function parseFlipkartJsonLd(html: string): SiteParseResult | null {
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
        const rawPrice = offer?.price ?? offer?.lowPrice;
        if (rawPrice === undefined || rawPrice === null) continue;
        const price = parseInrPrice(String(rawPrice));
        if (!price) continue;
        const currency = offer?.priceCurrency ?? "INR";
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

export function parseFlipkartPage(html: string): SiteParseResult | null {
  const jsonLd = parseFlipkartJsonLd(html);
  if (jsonLd) {
    if (detectOutOfStock(html, OUT_OF_STOCK_PATTERNS)) {
      return { ...jsonLd, isAvailable: false };
    }
    return jsonLd;
  }

  const priceMatch =
    html.match(/class="[^"]*Nx9bzj[^"]*"[^>]*>([^<]+)</i) ??
    html.match(/class="[^"]*_30jeq3[^"]*"[^>]*>([^<]+)</i) ??
    html.match(/class="[^"]*hl05eU[^"]*"[^>]*>([^<]+)</i);

  if (!priceMatch) return null;

  const price = parseInrPrice(priceMatch[1]);
  if (!price) return null;

  const isAvailable = !detectOutOfStock(html, OUT_OF_STOCK_PATTERNS);
  const titleMatch = html.match(/<span[^>]*class="[^"]*VU-ZEz[^"]*"[^>]*>([^<]+)</i);

  return {
    price,
    currency: "INR",
    title: titleMatch?.[1]?.trim(),
    isAvailable,
  };
}
