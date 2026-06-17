import { describe, it, expect } from "vitest";
import { shouldTriggerAlert } from "./evaluate-alert";

describe("shouldTriggerAlert", () => {
  it("returns false when target is null", () => {
    expect(shouldTriggerAlert(10, null)).toBe(false);
  });

  it("returns true when price <= target", () => {
    expect(shouldTriggerAlert(9.99, 10)).toBe(true);
    expect(shouldTriggerAlert(10, 10)).toBe(true);
  });

  it("returns false when price > target", () => {
    expect(shouldTriggerAlert(10.01, 10)).toBe(false);
  });
});
