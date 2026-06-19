export type SupportedSite = "amazon" | "flipkart" | "meesho" | "ebay" | "generic";

export function detectSite(url: string): SupportedSite {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("amazon.")) return "amazon";
    if (hostname.includes("flipkart.com")) return "flipkart";
    if (hostname.includes("meesho.com")) return "meesho";
    if (hostname.includes("ebay.")) return "ebay";
  } catch {
    // fall through
  }
  return "generic";
}

export function siteDisplayName(site: SupportedSite): string {
  switch (site) {
    case "amazon":
      return "Amazon";
    case "flipkart":
      return "Flipkart";
    case "meesho":
      return "Meesho";
    case "ebay":
      return "eBay";
    default:
      return "Other";
  }
}
