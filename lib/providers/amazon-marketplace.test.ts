import { describe, it, expect } from "vitest";
import { amazonCountryFromUrl } from "./amazon-marketplace";

describe("amazonCountryFromUrl", () => {
  it("maps amazon.com to us", () => {
    expect(amazonCountryFromUrl("https://www.amazon.com/dp/B0FB15XXWX")).toBe("us");
  });

  it("maps amazon.co.uk to gb", () => {
    expect(amazonCountryFromUrl("https://www.amazon.co.uk/dp/B0FB15XXWX")).toBe("gb");
  });

  it("maps amazon.de to de", () => {
    expect(amazonCountryFromUrl("https://www.amazon.de/dp/B0FB15XXWX")).toBe("de");
  });

  it("defaults to us for unknown hosts", () => {
    expect(amazonCountryFromUrl("https://example.com/product")).toBe("us");
  });
});
