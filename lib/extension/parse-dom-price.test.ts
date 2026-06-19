import { describe, it, expect } from "vitest";
import { parseDomPrice } from "./parse-dom-price";

describe("parseDomPrice", () => {
  it("parses USD price from amazon.com", () => {
    expect(
      parseDomPrice("$29.99", "https://www.amazon.com/dp/B000000000")
    ).toEqual({ price: 29.99, currency: "USD" });
  });

  it("parses thousands separators", () => {
    expect(
      parseDomPrice("$1,234.56", "https://www.amazon.com/dp/B000000000")
    ).toEqual({ price: 1234.56, currency: "USD" });
  });

  it("parses GBP from symbol", () => {
    expect(
      parseDomPrice("£19.99", "https://www.amazon.co.uk/dp/B000000000")
    ).toEqual({ price: 19.99, currency: "GBP" });
  });

  it("parses European comma decimal", () => {
    expect(
      parseDomPrice("24,99 €", "https://www.amazon.de/dp/B000000000")
    ).toEqual({ price: 24.99, currency: "EUR" });
  });

  it("uses marketplace currency for bare dollar on amazon.ca", () => {
    expect(
      parseDomPrice("$19.99", "https://www.amazon.ca/dp/B000000000")
    ).toEqual({ price: 19.99, currency: "CAD" });
  });

  it("throws when price text is empty", () => {
    expect(() =>
      parseDomPrice("", "https://www.amazon.com/dp/B000000000")
    ).toThrow("Cannot parse price from page");
  });
});
