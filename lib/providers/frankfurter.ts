import type {
  ExchangeRateProvider,
  ExchangeRateSnapshot,
} from "@/lib/currency/exchange-rate-provider";

const FRANKFURTER_LATEST_URL = "https://api.frankfurter.dev/v1/latest?base=EUR";

interface FrankfurterLatestResponse {
  base: string;
  rates: Record<string, number>;
}

export class FrankfurterProvider implements ExchangeRateProvider {
  async fetchRates(): Promise<ExchangeRateSnapshot> {
    const res = await fetch(FRANKFURTER_LATEST_URL);
    if (!res.ok) {
      throw new Error(`Frankfurter API failed: ${res.status}`);
    }

    const data = (await res.json()) as FrankfurterLatestResponse;
    return {
      base: data.base,
      rates: data.rates,
      fetchedAt: Date.now(),
    };
  }
}

export const frankfurterProvider = new FrankfurterProvider();
