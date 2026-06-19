import { convertCurrency } from "@/lib/currency/convert";
import type { ExchangeRateSnapshot } from "@/lib/currency/exchange-rate-provider";
import { getCachedRates } from "@/lib/currency/rate-cache";
import type { ExchangeRateProvider } from "@/lib/currency/exchange-rate-provider";
import { frankfurterProvider } from "@/lib/providers/frankfurter";
import type { PriceFetchResult } from "./price-provider";

export const APP_CURRENCY = "USD" as const;

export type NormalizedPriceResult = PriceFetchResult & {
  originalPrice?: number;
  originalCurrency?: string;
};

export function normalizeToUsd(
  result: PriceFetchResult,
  rateSnapshot: ExchangeRateSnapshot
): NormalizedPriceResult {
  const from = result.currency.toUpperCase();

  if (from === APP_CURRENCY) {
    return { ...result, currency: APP_CURRENCY };
  }

  const price = convertCurrency(
    result.price,
    from,
    APP_CURRENCY,
    rateSnapshot.base,
    rateSnapshot.rates
  );

  return {
    ...result,
    price,
    currency: APP_CURRENCY,
    originalPrice: result.price,
    originalCurrency: from,
  };
}

export async function normalizeFetchResultToUsd(
  result: PriceFetchResult,
  rateProvider: ExchangeRateProvider = frankfurterProvider
): Promise<NormalizedPriceResult> {
  const rateSnapshot = await getCachedRates(rateProvider);
  return normalizeToUsd(result, rateSnapshot);
}
