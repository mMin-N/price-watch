import type { SupportedSite } from "../detect-site";
import { parsePriceFromHtml } from "../parse-price";
import { parseEbayPage } from "./ebay";
import { parseFlipkartPage } from "./flipkart";
import { parseMeeshoPage } from "./meesho";
import type { SiteParseResult } from "./shared";

export function parseSitePage(
  html: string,
  site: SupportedSite
): SiteParseResult | null {
  let result: SiteParseResult | null = null;

  switch (site) {
    case "flipkart":
      result = parseFlipkartPage(html);
      break;
    case "meesho":
      result = parseMeeshoPage(html);
      break;
    case "ebay":
      result = parseEbayPage(html);
      break;
    default:
      result = parsePriceFromHtml(html);
      break;
  }

  if (!result) return null;

  if (result.isAvailable === undefined) {
    result = { ...result, isAvailable: true };
  }

  if (!result.title) {
    const title =
      html.match(/property="og:title"\s+content="([^"]+)"/i) ??
      html.match(/content="([^"]+)"\s+property="og:title"/i);
    if (title?.[1]) {
      result = { ...result, title: title[1].trim() };
    }
  }

  return result;
}
