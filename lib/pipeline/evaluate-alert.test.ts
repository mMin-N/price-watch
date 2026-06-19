import { describe, it, expect } from "vitest";
import { computeDiscountPercent, evaluateAlert } from "./evaluate-alert";

describe("computeDiscountPercent", () => {
  it("returns 20 when price dropped from 100 to 80", () => {
    expect(computeDiscountPercent(100, 80)).toBe(20);
  });
});

describe("evaluateAlert", () => {
  it("returns false when no alert rules are set", () => {
    expect(evaluateAlert(80, null, null, 100)).toEqual({
      triggered: false,
      reason: null,
      discountPercent: null,
    });
  });

  it("triggers on target price", () => {
    expect(evaluateAlert(9.99, 10, null, 100)).toMatchObject({
      triggered: true,
      reason: "target_price",
    });
  });

  it("triggers on discount percent", () => {
    expect(evaluateAlert(75, null, 20, 100)).toMatchObject({
      triggered: true,
      reason: "discount_percent",
      discountPercent: 25,
    });
  });

  it("does not trigger when discount is below threshold", () => {
    expect(evaluateAlert(85, null, 20, 100).triggered).toBe(false);
  });

  it("does not trigger when discount alert percent is zero", () => {
    expect(evaluateAlert(50, null, 0, 100).triggered).toBe(false);
  });

  it("target price takes precedence when both match", () => {
    expect(evaluateAlert(50, 60, 10, 100).reason).toBe("target_price");
  });
});
