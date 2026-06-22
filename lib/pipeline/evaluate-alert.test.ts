import { describe, it, expect } from "vitest";
import { computeDiscountPercent, evaluateAlert } from "./evaluate-alert";

describe("computeDiscountPercent", () => {
  it("returns 20 when price dropped from 100 to 80", () => {
    expect(computeDiscountPercent(100, 80)).toBe(20);
  });
});

describe("evaluateAlert", () => {
  it("returns false when baseline is missing", () => {
    expect(evaluateAlert(80, null, null)).toEqual({
      triggered: false,
      reason: null,
      discountPercent: null,
    });
  });

  it("triggers on any drop when no minimum threshold is set", () => {
    expect(evaluateAlert(99, null, 100)).toMatchObject({
      triggered: true,
      reason: "discount_percent",
    });
  });

  it("triggers when discount meets threshold", () => {
    expect(evaluateAlert(75, 20, 100)).toMatchObject({
      triggered: true,
      reason: "discount_percent",
      discountPercent: 25,
    });
  });

  it("does not trigger when discount is below threshold", () => {
    expect(evaluateAlert(85, 20, 100).triggered).toBe(false);
  });

  it("does not trigger when price is unchanged or higher", () => {
    expect(evaluateAlert(100, null, 100).triggered).toBe(false);
    expect(evaluateAlert(110, null, 100).triggered).toBe(false);
  });
});
