import { createPriceProvider } from "@/lib/providers/get-price-provider";
import { normalizeFetchResultToUsd } from "@/lib/providers/normalize-price";
import type { PriceFetchResult } from "@/lib/providers/price-provider";

export async function fetchNormalizedProductPrice(url: string): Promise<PriceFetchResult> {
  const rawResult = await createPriceProvider().fetchPrice(url);
  return normalizeFetchResultToUsd(rawResult);
}
