import { describe, it, expect } from "vitest";
import { normalizeProductUrl, urlsMatchForTracking } from "./normalize-product-url";

describe("normalizeProductUrl", () => {
  it("canonicalizes Amazon URLs to /dp/ASIN", () => {
    const long =
      "https://www.amazon.com/Thermaltake-Reactor/dp/B0FB15XXWX/ref=sr_1_1?qid=123";
    expect(normalizeProductUrl(long)).toBe(
      "https://www.amazon.com/dp/B0FB15XXWX"
    );
  });

  it("treats equivalent Amazon URLs as matching", () => {
    expect(
      urlsMatchForTracking(
        "https://www.amazon.com/dp/B0FB15XXWX",
        "https://www.amazon.com/gp/product/B0FB15XXWX/ref=abc"
      )
    ).toBe(true);
  });
});
