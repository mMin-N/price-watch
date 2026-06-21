import { describe, it, expect } from "vitest";
import { mapProduct, type ProductRow } from "./product-map";

function row(overrides: Partial<ProductRow>): ProductRow {
  return {
    id: "1",
    url: "https://www.amazon.com/dp/B0TEST",
    title: "Test",
    target_price: 80,
    discount_alert_percent: null,
    baseline_price: 100,
    currency: "USD",
    last_price: 90,
    last_fetched_at: null,
    wishlist_item_id: null,
    availability_status: "in_stock",
    consecutive_failures: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("mapProduct computed fields", () => {
  it("computes priceChange from baseline", () => {
    const p = mapProduct(row({ last_price: 90, baseline_price: 100 }));
    expect(p.priceChange).toBe(-10);
    expect(p.priceChangePercent).toBe(-10);
  });

  it("returns null change when baseline missing", () => {
    const p = mapProduct(row({ baseline_price: null }));
    expect(p.priceChange).toBeNull();
    expect(p.priceChangePercent).toBeNull();
  });

  it("computes distanceToTarget", () => {
    const p = mapProduct(row({ last_price: 90, target_price: 80 }));
    expect(p.distanceToTarget).toBe(10);
    expect(p.targetMet).toBe(false);
  });

  it("sets targetMet when at or below target", () => {
    expect(mapProduct(row({ last_price: 80, target_price: 80 })).targetMet).toBe(true);
    expect(mapProduct(row({ last_price: 75, target_price: 80 })).targetMet).toBe(true);
  });
});
