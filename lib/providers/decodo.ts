import type { PriceProvider, PriceFetchResult } from "./price-provider";
import { detectSite } from "./detect-site";
import { decodoGeoForSite } from "./geo-for-site";
import { decodoAuthorizationHeader } from "./decodo-auth";
import { buildDecodoScrapeBody } from "./decodo-scrape-config";
import { parseSitePage } from "./sites/parse-site-page";

const DECODO_SCRAPE_URL = "https://scraper-api.decodo.com/v2/scrape";

interface DecodoScrapeResult {
  content?: string;
  status_code?: number;
}

interface DecodoScrapeResponse {
  results?: DecodoScrapeResult[];
  status?: string;
  message?: string;
}

export class DecodoProvider implements PriceProvider {
  async fetchPrice(url: string): Promise<PriceFetchResult> {
    const site = detectSite(url);
    const geo = decodoGeoForSite(url, site);
    const authorization = decodoAuthorizationHeader();

    const body = buildDecodoScrapeBody(url, site, geo);

    const start = Date.now();
    const res = await fetch(DECODO_SCRAPE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify(body),
    });
    const durationMs = Date.now() - start;

    const payload = (await res.json()) as DecodoScrapeResponse;

    if (!res.ok || payload.status === "failed") {
      const message = payload.message ?? `HTTP ${res.status}`;
      console.error(
        JSON.stringify({ step: "fetch", url, site, status: res.status, durationMs, provider: "decodo", message })
      );
      throw new Error(`Decodo request failed: ${message}`);
    }

    const result = payload.results?.[0];
    const statusCode = result?.status_code;
    if (!result?.content || statusCode == null || statusCode >= 400) {
      console.error(
        JSON.stringify({
          step: "fetch",
          url,
          site,
          status: statusCode ?? res.status,
          durationMs,
          provider: "decodo",
        })
      );
      throw new Error(`Decodo request failed: ${statusCode ?? res.status}`);
    }

    const html = result.content;
    const parsed = parseSitePage(html, site);
    console.log(
      JSON.stringify({
        step: "provider_response",
        url,
        site,
        durationMs,
        provider: "decodo",
        parsed: !!parsed,
        isAvailable: parsed?.isAvailable,
      })
    );

    if (!parsed || parsed.price <= 0) {
      throw new Error("Cannot parse price from page");
    }

    return parsed;
  }
}
