import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveProviderId } from "./get-price-provider";

describe("resolveProviderId", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DECODO_API_KEY;
    delete process.env.DECODO_API_TOKEN;
    delete process.env.DECODO_USERNAME;
    delete process.env.DECODO_PASSWORD;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses zenrows for amazon URLs", () => {
    expect(resolveProviderId("https://www.amazon.com/dp/B0FB15XXWX")).toBe("zenrows");
  });

  it("uses decodo for flipkart when configured", () => {
    process.env.DECODO_API_KEY = "test-token";
    expect(resolveProviderId("https://www.flipkart.com/p/itm123")).toBe("decodo");
  });

  it("falls back to zenrows for flipkart when decodo is not configured", () => {
    expect(resolveProviderId("https://www.flipkart.com/p/itm123")).toBe("zenrows");
  });
});

describe("DecodoProvider", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv, DECODO_API_KEY: "test-token" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              status_code: 200,
              content: `
                <script type="application/ld+json">
                  {"@type":"Product","name":"Test Phone","offers":{"price":"12999","priceCurrency":"INR"}}
                </script>
              `,
            },
          ],
        }),
      })
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.stubGlobal("fetch", originalFetch);
    vi.restoreAllMocks();
  });

  it("parses flipkart HTML from decodo response", async () => {
    const { DecodoProvider } = await import("./decodo");
    const provider = new DecodoProvider();
    const result = await provider.fetchPrice("https://www.flipkart.com/product/p/itm123");

    expect(result).toMatchObject({
      price: 12999,
      currency: "INR",
      title: "Test Phone",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://scraper-api.decodo.com/v2/scrape",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Basic test-token",
        }),
      })
    );
  });
});
