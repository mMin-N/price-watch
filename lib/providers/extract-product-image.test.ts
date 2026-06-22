import { describe, expect, it } from "vitest";
import { extractImageFromHtml } from "./extract-product-image";

describe("extractImageFromHtml", () => {
  it("reads og:image meta tag", () => {
    const html = `<meta property="og:image" content="https://cdn.example.com/hero.jpg" />`;
    expect(extractImageFromHtml(html)).toBe("https://cdn.example.com/hero.jpg");
  });

  it("reads JSON-LD image array", () => {
    const html = `<script type="application/ld+json">{"image":["https://cdn.example.com/a.jpg"]}</script>`;
    expect(extractImageFromHtml(html)).toBe("https://cdn.example.com/a.jpg");
  });

  it("returns undefined when no image is present", () => {
    expect(extractImageFromHtml("<html><body>no image</body></html>")).toBeUndefined();
  });
});
