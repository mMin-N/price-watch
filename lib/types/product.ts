import type { SupportedSite } from "@/lib/providers/detect-site";

export type AvailabilityStatus = "in_stock" | "out_of_stock" | "unknown";

export type Product = {
  id: string;
  url: string;
  title: string | null;
  imageUrl: string | null;
  targetPrice: number | null;
  discountAlertPercent: number | null;
  baselinePrice: number | null;
  currency: string;
  lastPrice: number | null;
  lastFetchedAt: string | null;
  wishlistItemId: string | null;
  availabilityStatus: AvailabilityStatus;
  site: SupportedSite;
  siteName: string;
  alertActive: boolean;
  consecutiveFailures: number;
  autoRefreshPaused: boolean;
  priceChange: number | null;
  priceChangePercent: number | null;
  distanceToTarget: number | null;
  targetMet: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Wishlist = {
  id: string;
  name: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
  productCount: number;
};
