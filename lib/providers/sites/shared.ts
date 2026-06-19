import type { PriceFetchResult } from "../price-provider";

export type SiteParseResult = PriceFetchResult & {
  isAvailable?: boolean;
};

export function detectOutOfStock(html: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(html));
}

export function parseInrPrice(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  const price = parseFloat(cleaned);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function parseUsdPrice(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const price = parseFloat(cleaned);
  return Number.isFinite(price) && price > 0 ? price : null;
}
