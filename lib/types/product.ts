import type { SupportedSite } from "@/lib/providers/detect-site";

export type AvailabilityStatus = "in_stock" | "out_of_stock" | "unknown";

export type Product = {
  id: string;
  url: string;
  title: string | null;
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
