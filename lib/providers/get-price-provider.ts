import type { PriceFetchResult, PriceProvider } from "./price-provider";
import { detectSite, type SupportedSite } from "./detect-site";
import { extractAmazonAsin } from "./extract-amazon-asin";
import { isDecodoConfigured } from "./decodo-auth";
import { DecodoProvider } from "./decodo";
import { ZenRowsProvider } from "./zenrows";

const DECODO_SITES: SupportedSite[] = ["flipkart", "meesho", "ebay"];

class RoutingPriceProvider implements PriceProvider {
  constructor(
    private readonly zenrows: PriceProvider,
    private readonly decodo: PriceProvider | null
  ) {}

  async fetchPrice(url: string): Promise<PriceFetchResult> {
    const provider = selectProviderForUrl(url, this.zenrows, this.decodo);
    return provider.fetchPrice(url);
  }
}

function selectProviderForUrl(
  url: string,
  zenrows: PriceProvider,
  decodo: PriceProvider | null
): PriceProvider {
  if (extractAmazonAsin(url)) {
    return zenrows;
  }

  const site = detectSite(url);
  if (decodo && DECODO_SITES.includes(site)) {
    return decodo;
  }

  return zenrows;
}

export function resolveProviderId(url: string): string {
  if (extractAmazonAsin(url)) {
    return "zenrows";
  }

  const site = detectSite(url);
  if (isDecodoConfigured() && DECODO_SITES.includes(site)) {
    return "decodo";
  }

  return "zenrows";
}

export function createPriceProvider(): PriceProvider {
  const decodo = isDecodoConfigured() ? new DecodoProvider() : null;
  return new RoutingPriceProvider(new ZenRowsProvider(), decodo);
}
