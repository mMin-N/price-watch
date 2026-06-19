import { describe, it, expect } from "vitest";
import { parseEbayPage } from "./ebay";

describe("parseEbayPage", () => {
  it("parses JSON-LD offer", () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","name":"Vintage Lens","offers":{"price":"89.99","priceCurrency":"USD","availability":"https://schema.org/InStock"}}
      </script>
    `;
    expect(parseEbayPage(html)).toMatchObject({
      price: 89.99,
      currency: "USD",
      title: "Vintage Lens",
      isAvailable: true,
    });
  });

  it("detects ended listing", () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","offers":{"price":"10.00","priceCurrency":"USD"}}
      </script>
      <span>This listing has ended</span>
    `;
    expect(parseEbayPage(html)?.isAvailable).toBe(false);
  });

  it("parses itemprop price", () => {
    const html =
      '<meta itemprop="price" content="42.50" /><meta itemprop="priceCurrency" content="USD" />';
    expect(parseEbayPage(html)).toMatchObject({
      price: 42.5,
      currency: "USD",
    });
  });
});
