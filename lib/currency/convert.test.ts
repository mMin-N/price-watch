import { describe, it, expect } from "vitest";
import { convertCurrency, UnsupportedCurrencyError } from "./convert";

const mockRates = {
  USD: 1.08,
  GBP: 0.85,
  JPY: 160.12,
};

describe("convertCurrency", () => {
  it("returns amount unchanged when from and to are the same", () => {
    expect(convertCurrency(100, "USD", "USD", "EUR", mockRates)).toBe(100);
  });

  it("converts EUR to USD using ECB-style rates", () => {
    expect(convertCurrency(100, "EUR", "USD", "EUR", mockRates)).toBe(108);
  });

  it("converts GBP to USD via EUR base", () => {
    const result = convertCurrency(100, "GBP", "USD", "EUR", mockRates);
    expect(result).toBeCloseTo(127.06, 2);
  });

  it("throws for unsupported source currency", () => {
    expect(() => convertCurrency(100, "XYZ", "USD", "EUR", mockRates)).toThrow(
      UnsupportedCurrencyError
    );
  });
});
