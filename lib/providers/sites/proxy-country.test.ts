import { describe, it, expect } from "vitest";
import { proxyCountryForSite } from "./proxy-country";

describe("proxyCountryForSite", () => {
  it("uses in for flipkart and meesho", () => {
    expect(proxyCountryForSite("https://www.flipkart.com/p", "flipkart")).toBe("in");
    expect(proxyCountryForSite("https://www.meesho.com/p", "meesho")).toBe("in");
  });

  it("uses gb for ebay.co.uk", () => {
    expect(proxyCountryForSite("https://www.ebay.co.uk/itm/1", "ebay")).toBe("gb");
  });
});
