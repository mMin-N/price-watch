import type { PriceFetchResult } from "./price-provider";

export function parsePriceFromHtml(html: string): PriceFetchResult | null {
  const ogMatch = html.match(/property="og:price:amount"\s+content="([\d.]+)"/i)
    ?? html.match(/content="([\d.]+)"\s+property="og:price:amount"/i);
  if (ogMatch) {
    return { price: parseFloat(ogMatch[1]), currency: "USD" };
  }
  const dollarMatch = html.match(/\$\s*([\d,]+\.?\d*)/);
  if (dollarMatch) {
    return { price: parseFloat(dollarMatch[1].replace(/,/g, "")), currency: "USD" };
  }
  return null;
}
