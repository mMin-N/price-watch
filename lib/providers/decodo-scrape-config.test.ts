import { describe, it, expect } from "vitest";
import { buildDecodoScrapeBody } from "./decodo-scrape-config";

describe("buildDecodoScrapeBody", () => {
  it("adds wait actions for ebay", () => {
    const body = buildDecodoScrapeBody(
      "https://www.ebay.com/itm/123",
      "ebay",
      "United States"
    );

    expect(body.target).toBe("universal");
    expect(body.browser_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "wait_for_element" }),
        expect.objectContaining({ type: "wait", wait_time_s: 3 }),
      ])
    );
  });

  it("keeps flipkart requests lean", () => {
    const body = buildDecodoScrapeBody(
      "https://www.flipkart.com/p/itm123",
      "flipkart",
      "India"
    );

    expect(body.target).toBeUndefined();
    expect(body.browser_actions).toBeUndefined();
  });

  it("uses India geo and waits for meesho next data", () => {
    const body = buildDecodoScrapeBody(
      "https://www.meesho.com/kurti/p/abc",
      "meesho",
      "India"
    );

    expect(body.geo).toBe("India");
    expect(body.browser_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "wait_for_element",
          selector: { type: "css", value: "script#__NEXT_DATA__" },
        }),
      ])
    );
  });
});
