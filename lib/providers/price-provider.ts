export interface PriceFetchResult {
  price: number;
  currency: string;
  title?: string;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface PriceProvider {
  fetchPrice(url: string): Promise<PriceFetchResult>;
}
