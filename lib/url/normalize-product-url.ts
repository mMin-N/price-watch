import { extractAmazonAsin } from "@/lib/providers/extract-amazon-asin";

export function normalizeProductUrl(url: string): string {
  const trimmed = url.trim();

  try {
    const asin = extractAmazonAsin(trimmed);
    if (asin) {
      const { hostname } = new URL(trimmed);
      return `https://${hostname.toLowerCase()}/dp/${asin}`;
    }

    const parsed = new URL(trimmed);
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = "";
    const normalized = parsed.href.replace(/\/$/, "");
    return normalized;
  } catch {
    return trimmed;
  }
}

export function urlsMatchForTracking(a: string, b: string): boolean {
  return normalizeProductUrl(a) === normalizeProductUrl(b);
}
