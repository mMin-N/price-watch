import { describe, it, expect } from "vitest";
import { computeAlertActive, availabilityFromFetch } from "./compute-alert-active";
import type { ProductRow } from "@/lib/api/product-map";

function row(overrides: Partial<ProductRow>): ProductRow {
  return {
    id: "1",
    url: "https://www.amazon.com/dp/B0TEST",
    title: "Test",
    target_price: 10,
    discount_alert_percent: null,
    baseline_price: 100,
    currency: "USD",
    last_price: 9,
    last_fetched_at: null,
    wishlist_item_id: null,
    availability_status: "unknown",
    consecutive_failures: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("availabilityFromFetch", () => {
  it("maps isAvailable false to out_of_stock", () => {
    expect(availabilityFromFetch(false)).toBe("out_of_stock");
  });
});

describe("computeAlertActive", () => {
  it("returns false when out of stock", () => {
    expect(
      computeAlertActive(row({ availability_status: "out_of_stock", last_price: 1 }))
    ).toBe(false);
  });

  it("returns true when target price met", () => {
    expect(computeAlertActive(row({ last_price: 9, target_price: 10 }))).toBe(true);
  });
});
