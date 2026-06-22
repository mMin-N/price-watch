import { describe, it, expect } from "vitest";
import { resolveAlertActiveState } from "./resolve-alert-active-state";
import { evaluateAlert } from "@/lib/pipeline/evaluate-alert";

describe("resolveAlertActiveState", () => {
  it("notifies on first price drop", () => {
    const evaluation = evaluateAlert(99, null, 100);
    const state = resolveAlertActiveState(99, null, 100, false, evaluation);
    expect(state.shouldNotify).toBe(true);
    expect(state.discountAlertActive).toBe(true);
  });

  it("does not notify when discount alert is already active", () => {
    const evaluation = evaluateAlert(99, null, 100);
    const state = resolveAlertActiveState(99, null, 100, true, evaluation);
    expect(state.shouldNotify).toBe(false);
    expect(state.discountAlertActive).toBe(true);
  });

  it("clears discount alert when price recovers to baseline", () => {
    const evaluation = evaluateAlert(100, null, 100);
    const state = resolveAlertActiveState(100, null, 100, true, evaluation);
    expect(state.shouldNotify).toBe(false);
    expect(state.discountAlertActive).toBe(false);
  });

  it("re-notifies after price recovers then drops again", () => {
    const recovered = evaluateAlert(100, null, 100);
    const cleared = resolveAlertActiveState(100, null, 100, true, recovered);
    expect(cleared.discountAlertActive).toBe(false);

    const dropped = evaluateAlert(95, null, 100);
    const state = resolveAlertActiveState(
      95,
      null,
      100,
      cleared.discountAlertActive,
      dropped
    );
    expect(state.shouldNotify).toBe(true);
  });

  it("notifies on discount trigger only once while active", () => {
    const evaluation = evaluateAlert(75, 20, 100);
    const first = resolveAlertActiveState(75, 20, 100, false, evaluation);
    expect(first.shouldNotify).toBe(true);

    const second = resolveAlertActiveState(75, 20, 100, true, evaluation);
    expect(second.shouldNotify).toBe(false);
  });
});
