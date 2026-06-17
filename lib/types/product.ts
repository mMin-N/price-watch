export type Product = {
  id: string;
  url: string;
  title: string | null;
  targetPrice: number | null;
  currency: string;
  lastPrice: number | null;
  lastFetchedAt: string | null;
  wishlistItemId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Wishlist = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  productCount: number;
};
