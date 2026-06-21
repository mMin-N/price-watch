export type ProductListItem = {
  id: string;
  url: string;
  title: string | null;
  targetPrice: number | null;
  discountAlertPercent: number | null;
  baselinePrice: number | null;
  lastPrice: number | null;
  lastFetchedAt: string | null;
  currency: string;
  siteName: string;
  alertActive: boolean;
  autoRefreshPaused: boolean;
  priceChange: number | null;
  priceChangePercent: number | null;
  distanceToTarget: number | null;
  targetMet: boolean;
  createdAt: string;
};

export function sortProductsByUrgency(products: ProductListItem[]): ProductListItem[] {
  return [...products].sort((a, b) => {
    if (a.alertActive !== b.alertActive) return a.alertActive ? -1 : 1;

    const aDist = a.distanceToTarget;
    const bDist = b.distanceToTarget;
    if (aDist !== null && bDist !== null && aDist !== bDist) {
      return aDist - bDist;
    }
    if (aDist !== null && bDist === null) return -1;
    if (aDist === null && bDist !== null) return 1;

    const aChange = Math.abs(a.priceChange ?? 0);
    const bChange = Math.abs(b.priceChange ?? 0);
    if (aChange !== bChange) return bChange - aChange;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
