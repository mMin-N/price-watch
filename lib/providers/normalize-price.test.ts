import { describe, it, expect } from "vitest";
import { normalizeToUsd } from "./normalize-price";

const eurBaseRates = {
  base: "EUR",
  rates: { USD: 1.08, GBP: 0.85 },
  fetchedAt: Date.now(),
};

describe("normalizeToUsd", () => {
  it("passes through USD without changing price", () => {
    expect(
      normalizeToUsd({ price: 29.99, currency: "USD", title: "Test" }, eurBaseRates)
    ).toEqual({
      price: 29.99,
      currency: "USD",
      title: "Test",
    });
  });

  it("converts non-USD price to USD", () => {
    const result = normalizeToUsd(
      { price: 100, currency: "EUR", title: "Test" },
      eurBaseRates
    );

    expect(result).toMatchObject({
      price: 108,
      currency: "USD",
      originalPrice: 100,
      originalCurrency: "EUR",
      title: "Test",
    });
  });
});
