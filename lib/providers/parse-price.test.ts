import { describe, it, expect } from "vitest";
import { parsePriceFromHtml } from "./parse-price";

describe("parsePriceFromHtml", () => {
  it("extracts price from meta og:price:amount", () => {
    const html = '<meta property="og:price:amount" content="29.99" />';
    expect(parsePriceFromHtml(html)).toEqual({ price: 29.99, currency: "USD" });
  });

  it("extracts price from dollar text", () => {
    const html = '<span class="price">$19.50</span>';
    expect(parsePriceFromHtml(html)).toEqual({ price: 19.5, currency: "USD" });
  });

  it("returns null when no price found", () => {
    expect(parsePriceFromHtml("<html></html>")).toBeNull();
  });
});
