import type { SupportedSite } from "../detect-site";
import { amazonCountryFromUrl } from "../amazon-marketplace";

const EBAY_HOST_TO_COUNTRY: Record<string, string> = {
  "ebay.com": "us",
  "ebay.co.uk": "gb",
  "ebay.de": "de",
  "ebay.fr": "fr",
  "ebay.it": "it",
  "ebay.es": "es",
  "ebay.ca": "ca",
  "ebay.com.au": "au",
  "ebay.in": "in",
};

export function ebayCountryFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (EBAY_HOST_TO_COUNTRY[hostname]) {
      return EBAY_HOST_TO_COUNTRY[hostname];
    }
  } catch {
    // fall through
  }
  return "us";
}

export function proxyCountryForSite(url: string, site: SupportedSite): string {
  switch (site) {
    case "flipkart":
    case "meesho":
      return "in";
    case "amazon":
      return amazonCountryFromUrl(url);
    case "ebay":
      return ebayCountryFromUrl(url);
    default:
      return "us";
  }
}
