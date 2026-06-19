export type RatesTable = Record<string, number>;

export interface ExchangeRateSnapshot {
  base: string;
  rates: RatesTable;
  fetchedAt: number;
}

export interface ExchangeRateProvider {
  fetchRates(): Promise<ExchangeRateSnapshot>;
}
