import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriceProvider, PriceFetchResult } from "./price-provider";
import { detectSite } from "./detect-site";
import { amazonCountryFromUrl } from "./amazon-marketplace";
import { extractAmazonAsin } from "./extract-amazon-asin";
import { parseSitePage } from "./sites/parse-site-page";
import { proxyCountryForSite } from "./sites/proxy-country";

interface AmazonProductResponse {
  product_price?: number;
  price_currency_code?: string;
  product_name?: string;
  product_images?: string[];
  is_available?: boolean;
}

export class ZenRowsProvider implements PriceProvider {
  async fetchPrice(url: string): Promise<PriceFetchResult> {
    const apiKey = process.env.ZENROWS_API_KEY;
    if (!apiKey) throw new Error("ZENROWS_API_KEY not configured");

    const asin = extractAmazonAsin(url);
    if (asin) {
      return this.fetchAmazonProduct(apiKey, asin, url);
    }

    return this.fetchUniversalPage(apiKey, url);
  }

  private async fetchAmazonProduct(
    apiKey: string,
    asin: string,
    url: string
  ): Promise<PriceFetchResult> {
    const country = amazonCountryFromUrl(url);
    const params = new URLSearchParams({ apikey: apiKey, country });
    const start = Date.now();
    const res = await fetch(
      `https://ecommerce.api.zenrows.com/v1/targets/amazon/products/${asin}?${params}`
    );
    const durationMs = Date.now() - start;

    if (!res.ok) {
      console.error(
        JSON.stringify({ step: "fetch", url, asin, status: res.status, durationMs, provider: "amazon_api" })
      );
      throw new Error(`ZenRows Amazon API failed: ${res.status}`);
    }

    const data = (await res.json()) as AmazonProductResponse;
    const price = data.product_price;
    const isAvailable = data.is_available !== false;

    console.log(
      JSON.stringify({
        step: "provider_response",
        url,
        asin,
        durationMs,
        provider: "amazon_api",
        parsed: price != null,
        isAvailable,
      })
    );

    if (price == null || Number.isNaN(price) || price <= 0) {
      throw new Error("Cannot parse price from page");
    }

    return {
      price,
      currency: data.price_currency_code ?? "USD",
      title: data.product_name,
      imageUrl: data.product_images?.[0],
      isAvailable,
    };
  }

  private async fetchUniversalPage(apiKey: string, url: string): Promise<PriceFetchResult> {
    const site = detectSite(url);
    const proxyCountry = proxyCountryForSite(url, site);
    const params = new URLSearchParams({
      apikey: apiKey,
      url,
      js_render: "true",
      premium_proxy: "true",
      proxy_country: proxyCountry,
      wait: "3000",
    });
    const start = Date.now();
    const res = await fetch(`https://api.zenrows.com/v1/?${params}`);
    const durationMs = Date.now() - start;

    if (!res.ok) {
      console.error(JSON.stringify({ step: "fetch", url, site, status: res.status, durationMs }));
      throw new Error(`ZenRows request failed: ${res.status}`);
    }

    const html = await res.text();
    const parsed = parseSitePage(html, site);
    console.log(
      JSON.stringify({
        step: "provider_response",
        url,
        site,
        durationMs,
        parsed: !!parsed,
        isAvailable: parsed?.isAvailable,
      })
    );

    if (!parsed) {
      throw new Error("Cannot parse price from page");
    }

    if (parsed.price <= 0) {
      throw new Error("Cannot parse price from page");
    }

    return parsed;
  }
}
