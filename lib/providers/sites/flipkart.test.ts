import { describe, it, expect } from "vitest";
import { parseFlipkartPage } from "./flipkart";

describe("parseFlipkartPage", () => {
  it("parses JSON-LD offer in INR", () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","name":"Test Phone","offers":{"price":"12999","priceCurrency":"INR","availability":"https://schema.org/InStock"}}
      </script>
    `;
    expect(parseFlipkartPage(html)).toMatchObject({
      price: 12999,
      currency: "INR",
      title: "Test Phone",
      isAvailable: true,
    });
  });

  it("marks unavailable when sold out text present", () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","offers":{"price":"999","priceCurrency":"INR"}}
      </script>
      <div>Currently Unavailable</div>
    `;
    expect(parseFlipkartPage(html)?.isAvailable).toBe(false);
  });

  it("parses price class fallback", () => {
    const html = '<div class="_30jeq3">₹1,499</div>';
    expect(parseFlipkartPage(html)).toMatchObject({
      price: 1499,
      currency: "INR",
    });
  });
});
