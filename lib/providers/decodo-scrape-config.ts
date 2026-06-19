import type { SupportedSite } from "./detect-site";

type DecodoBrowserAction =
  | { type: "wait"; wait_time_s: number }
  | {
      type: "wait_for_element";
      selector: { type: "css"; value: string };
      timeout_s: number;
      on_error?: "skip" | "error";
    };

export interface DecodoScrapeBody {
  target?: "universal";
  url: string;
  proxy_pool: "premium";
  headless: "html";
  geo: string;
  browser_actions?: DecodoBrowserAction[];
}

export function buildDecodoScrapeBody(
  url: string,
  site: SupportedSite,
  geo: string
): DecodoScrapeBody {
  const body: DecodoScrapeBody = {
    url,
    proxy_pool: "premium",
    headless: "html",
    geo,
  };

  if (site === "ebay") {
    return {
      ...body,
      target: "universal",
      browser_actions: [
        {
          type: "wait_for_element",
          selector: { type: "css", value: '[data-testid="x-price-primary"]' },
          timeout_s: 15,
          on_error: "skip",
        },
        {
          type: "wait_for_element",
          selector: { type: "css", value: '[itemprop="price"]' },
          timeout_s: 10,
          on_error: "skip",
        },
        { type: "wait", wait_time_s: 3 },
      ],
    };
  }

  if (site === "meesho") {
    return {
      ...body,
      target: "universal",
      browser_actions: [
        {
          type: "wait_for_element",
          selector: { type: "css", value: "script#__NEXT_DATA__" },
          timeout_s: 15,
          on_error: "skip",
        },
        {
          type: "wait_for_element",
          selector: { type: "css", value: '[property="product:price:amount"]' },
          timeout_s: 10,
          on_error: "skip",
        },
        { type: "wait", wait_time_s: 5 },
      ],
    };
  }

  return body;
}
