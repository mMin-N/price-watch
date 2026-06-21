import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatRelativeTime,
  formatPriceChange,
  formatDistanceToTarget,
} from "./display";

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns em dash for null", () => {
    expect(formatRelativeTime(null)).toBe("—");
  });

  it('returns "just now" for < 60s ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
    expect(formatRelativeTime("2026-06-20T11:59:30Z")).toBe("just now");
  });

  it("returns minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
    expect(formatRelativeTime("2026-06-20T11:55:00Z")).toBe("5m ago");
  });

  it("returns hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
    expect(formatRelativeTime("2026-06-20T09:00:00Z")).toBe("3h ago");
  });
});

describe("formatPriceChange", () => {
  it("returns null when amount is null", () => {
    expect(formatPriceChange(null, null, "USD")).toBeNull();
  });

  it("formats drop with down arrow", () => {
    const result = formatPriceChange(-5.2, -5.8, "USD");
    expect(result?.text).toContain("↓");
    expect(result?.direction).toBe("down");
  });

  it("formats rise with up arrow", () => {
    const result = formatPriceChange(3, 3.2, "USD");
    expect(result?.text).toContain("↑");
    expect(result?.direction).toBe("up");
  });
});

describe("formatDistanceToTarget", () => {
  it("returns null when distance is null", () => {
    expect(formatDistanceToTarget(null, "USD")).toBeNull();
  });

  it('returns "Target met!" when distance <= 0', () => {
    expect(formatDistanceToTarget(-2, "USD")?.text).toBe("Target met!");
  });

  it("formats above target", () => {
    const result = formatDistanceToTarget(3.2, "USD");
    expect(result?.text).toContain("above target");
  });
});
