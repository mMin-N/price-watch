import { describe, it, expect } from "vitest";
import { extractAmazonAsin } from "./extract-amazon-asin";

describe("extractAmazonAsin", () => {
  it("extracts ASIN from /dp/ URL", () => {
    const url =
      "https://www.amazon.com/Thermaltake-Reactor/dp/B0FB15XXWX/ref=sr_1_1";
    expect(extractAmazonAsin(url)).toBe("B0FB15XXWX");
  });

  it("returns null for non-Amazon URLs", () => {
    expect(extractAmazonAsin("https://www.ebay.com/itm/123")).toBeNull();
  });

  it("returns null when no ASIN in path", () => {
    expect(extractAmazonAsin("https://www.amazon.com/s?k=gpu")).toBeNull();
  });
});
