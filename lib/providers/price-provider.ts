export interface PriceFetchResult {
  price: number;
  currency: string;
}

export interface PriceProvider {
  fetchPrice(url: string): Promise<PriceFetchResult>;
}
