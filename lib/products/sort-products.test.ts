import { describe, it, expect } from "vitest";
import { sortProductsByUrgency } from "./sort-products";
import type { Product } from "@/lib/types/product";

function product(overrides: Partial<Product>): Product {
  return {
    id: "x",
    url: "https://amazon.com/dp/1",
    title: "Item",
    targetPrice: null,
    discountAlertPercent: null,
    baselinePrice: 100,
    currency: "USD",
    lastPrice: 100,
    lastFetchedAt: null,
    wishlistItemId: null,
    availabilityStatus: "in_stock",
    site: "amazon",
    siteName: "Amazon",
    alertActive: false,
    consecutiveFailures: 0,
    autoRefreshPaused: false,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    priceChange: 0,
    priceChangePercent: 0,
    distanceToTarget: null,
    targetMet: false,
    ...overrides,
  };
}

describe("sortProductsByUrgency", () => {
  it("puts alertActive first", () => {
    const sorted = sortProductsByUrgency([
      product({ id: "a", alertActive: false }),
      product({ id: "b", alertActive: true }),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("sorts by smallest distanceToTarget when no alert", () => {
    const sorted = sortProductsByUrgency([
      product({
        id: "far",
        distanceToTarget: 20,
        targetPrice: 80,
        lastPrice: 100,
      }),
      product({
        id: "near",
        distanceToTarget: 2,
        targetPrice: 98,
        lastPrice: 100,
      }),
    ]);
    expect(sorted[0].id).toBe("near");
  });
});
