import { describe, it, expect } from "vitest";
import { detectSite } from "./detect-site";

describe("detectSite", () => {
  it("detects amazon", () => {
    expect(detectSite("https://www.amazon.com/dp/B0FB15XXWX")).toBe("amazon");
  });

  it("detects flipkart", () => {
    expect(detectSite("https://www.flipkart.com/product/p/itm123")).toBe("flipkart");
  });

  it("detects meesho", () => {
    expect(detectSite("https://www.meesho.com/product/p/abc")).toBe("meesho");
  });

  it("detects ebay", () => {
    expect(detectSite("https://www.ebay.com/itm/123")).toBe("ebay");
  });

  it("returns generic for unknown", () => {
    expect(detectSite("https://example.com/item")).toBe("generic");
  });
});
