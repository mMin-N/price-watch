import type {
  ExchangeRateProvider,
  ExchangeRateSnapshot,
} from "./exchange-rate-provider";

const TTL_MS = 24 * 60 * 60 * 1000;

let cached: ExchangeRateSnapshot | null = null;
let inFlight: Promise<ExchangeRateSnapshot> | null = null;

export function clearRateCacheForTests() {
  cached = null;
  inFlight = null;
}

export async function getCachedRates(
  provider: ExchangeRateProvider
): Promise<ExchangeRateSnapshot> {
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached;
  }

  if (!inFlight) {
    inFlight = provider
      .fetchRates()
      .then((snapshot) => {
        cached = snapshot;
        inFlight = null;
        return snapshot;
      })
      .catch((err) => {
        inFlight = null;
        throw err;
      });
  }

  return inFlight;
}
