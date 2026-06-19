import { describe, it, expect } from "vitest";
import { resolveAlertActiveState } from "./resolve-alert-active-state";
import { evaluateAlert } from "@/lib/pipeline/evaluate-alert";

describe("resolveAlertActiveState", () => {
  it("notifies on first target price trigger", () => {
    const evaluation = evaluateAlert(9, 10, null, 100);
    const state = resolveAlertActiveState(9, 10, null, 100, false, false, evaluation);
    expect(state.shouldNotify).toBe(true);
    expect(state.targetPriceAlertActive).toBe(true);
  });

  it("does not notify when target alert is already active", () => {
    const evaluation = evaluateAlert(9, 10, null, 100);
    const state = resolveAlertActiveState(9, 10, null, 100, true, false, evaluation);
    expect(state.shouldNotify).toBe(false);
    expect(state.targetPriceAlertActive).toBe(true);
  });

  it("clears target alert when price rises above target", () => {
    const evaluation = evaluateAlert(12, 10, null, 100);
    const state = resolveAlertActiveState(12, 10, null, 100, true, false, evaluation);
    expect(state.shouldNotify).toBe(false);
    expect(state.targetPriceAlertActive).toBe(false);
  });

  it("re-notifies after price recovers then drops again", () => {
    const recovered = evaluateAlert(12, 10, null, 100);
    const cleared = resolveAlertActiveState(12, 10, null, 100, true, false, recovered);
    expect(cleared.targetPriceAlertActive).toBe(false);

    const dropped = evaluateAlert(9, 10, null, 100);
    const state = resolveAlertActiveState(
      9,
      10,
      null,
      100,
      cleared.targetPriceAlertActive,
      false,
      dropped
    );
    expect(state.shouldNotify).toBe(true);
  });

  it("notifies on discount trigger only once while active", () => {
    const evaluation = evaluateAlert(75, null, 20, 100);
    const first = resolveAlertActiveState(75, null, 20, 100, false, false, evaluation);
    expect(first.shouldNotify).toBe(true);

    const second = resolveAlertActiveState(75, null, 20, 100, false, true, evaluation);
    expect(second.shouldNotify).toBe(false);
  });
});
