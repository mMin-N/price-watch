import { describe, it, expect } from "vitest";
import {
  isAutoRefreshPaused,
  isDueForRefresh,
  isUserActive,
  refreshIntervalMsForSite,
} from "./tracking-policy";

describe("tracking-policy", () => {
  it("uses 12h for ebay and meesho", () => {
    expect(refreshIntervalMsForSite("ebay")).toBe(12 * 60 * 60 * 1000);
    expect(refreshIntervalMsForSite("meesho")).toBe(12 * 60 * 60 * 1000);
  });

  it("uses 6h for amazon and flipkart", () => {
    expect(refreshIntervalMsForSite("amazon")).toBe(6 * 60 * 60 * 1000);
    expect(refreshIntervalMsForSite("flipkart")).toBe(6 * 60 * 60 * 1000);
  });

  it("marks refresh due when interval elapsed", () => {
    const now = Date.now();
    const fiveHoursAgo = new Date(now - 5 * 60 * 60 * 1000).toISOString();
    const sevenHoursAgo = new Date(now - 7 * 60 * 60 * 1000).toISOString();

    expect(isDueForRefresh(fiveHoursAgo, "amazon", now)).toBe(false);
    expect(isDueForRefresh(sevenHoursAgo, "amazon", now)).toBe(true);
    expect(isDueForRefresh(sevenHoursAgo, "ebay", now)).toBe(false);
  });

  it("pauses inactive users after 72h", () => {
    const now = Date.now();
    const recent = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const stale = new Date(now - 80 * 60 * 60 * 1000).toISOString();

    expect(isUserActive(recent, now)).toBe(true);
    expect(isUserActive(stale, now)).toBe(false);
    expect(isUserActive(null, now)).toBe(false);
  });

  it("pauses auto refresh after 3 failures", () => {
    expect(isAutoRefreshPaused(2)).toBe(false);
    expect(isAutoRefreshPaused(3)).toBe(true);
  });
});
