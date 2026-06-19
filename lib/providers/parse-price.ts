import type { PriceFetchResult } from "./price-provider";

function parseJsonLdPrice(html: string): PriceFetchResult | null {
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
        if (rawPrice !== undefined && rawPrice !== null) {
          const price = parseFloat(String(rawPrice).replace(/,/g, ""));
          if (!Number.isNaN(price)) {
            const currency = offer?.priceCurrency ?? "USD";
            return { price, currency };
          }
        }
      }
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }

  return null;
}

export function parsePriceFromHtml(html: string): PriceFetchResult | null {
  if (/captcha|robot check|continue shopping/i.test(html) && html.length < 50_000) {
    return null;
  }

  const ogMatch =
    html.match(/property="og:price:amount"\s+content="([\d.]+)"/i) ??
    html.match(/content="([\d.]+)"\s+property="og:price:amount"/i);
  if (ogMatch) {
    return { price: parseFloat(ogMatch[1]), currency: "USD" };
  }

  const amazonOffscreen = html.match(
    /<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>\s*\$?\s*([\d,]+\.?\d*)/i
  );
  if (amazonOffscreen) {
    return {
      price: parseFloat(amazonOffscreen[1].replace(/,/g, "")),
      currency: "USD",
    };
  }

  const priceAmount = html.match(/"priceAmount"\s*:\s*([\d.]+)/i);
  if (priceAmount) {
    return { price: parseFloat(priceAmount[1]), currency: "USD" };
  }

  const jsonLd = parseJsonLdPrice(html);
  if (jsonLd) return jsonLd;

  const dollarMatch = html.match(/\$\s*([\d,]+\.\d{2})/);
  if (dollarMatch) {
    return { price: parseFloat(dollarMatch[1].replace(/,/g, "")), currency: "USD" };
  }

  return null;
}
