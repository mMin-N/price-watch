import type { Product } from "@/lib/types/product";

export function sortProductsByUrgency(products: Product[]): Product[] {
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
