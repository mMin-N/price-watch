import type { PriceProvider, PriceFetchResult } from "./price-provider";
import { parsePriceFromHtml } from "./parse-price";

export class ZenRowsProvider implements PriceProvider {
  async fetchPrice(url: string): Promise<PriceFetchResult> {
    const apiKey = process.env.ZENROWS_API_KEY;
    if (!apiKey) throw new Error("ZENROWS_API_KEY not configured");

    const params = new URLSearchParams({
      apikey: apiKey,
      url,
      js_render: "true",
    });
    const start = Date.now();
    const res = await fetch(`https://api.zenrows.com/v1/?${params}`);
    const durationMs = Date.now() - start;

    if (!res.ok) {
      console.error(JSON.stringify({ step: "fetch", url, status: res.status, durationMs }));
      throw new Error(`ZenRows request failed: ${res.status}`);
    }

    const html = await res.text();
    const parsed = parsePriceFromHtml(html);
    console.log(JSON.stringify({ step: "provider_response", url, durationMs, parsed: !!parsed }));

    if (!parsed) {
      throw new Error("Cannot parse price from page");
    }
    return parsed;
  }
}
