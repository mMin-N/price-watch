import {
  computeDiscountPercent,
  type AlertEvaluation,
  type AlertTriggerReason,
} from "@/lib/pipeline/evaluate-alert";

export type AlertActiveState = {
  targetPriceAlertActive: boolean;
  discountAlertActive: boolean;
  shouldNotify: boolean;
};

export function resolveAlertActiveState(
  price: number,
  targetPrice: number | null,
  discountAlertPercent: number | null,
  baselinePrice: number | null,
  currentTargetActive: boolean,
  currentDiscountActive: boolean,
  evaluation: AlertEvaluation
): AlertActiveState {
  let targetPriceAlertActive = currentTargetActive;
  let discountAlertActive = currentDiscountActive;

  if (targetPrice === null || price > targetPrice) {
    targetPriceAlertActive = false;
  }

  if (
    discountAlertPercent === null ||
    discountAlertPercent <= 0 ||
    baselinePrice === null ||
    baselinePrice <= 0
  ) {
    discountAlertActive = false;
  } else {
    const discountPercent = computeDiscountPercent(baselinePrice, price);
    if (discountPercent < discountAlertPercent) {
      discountAlertActive = false;
    }
  }

  let shouldNotify = false;
  if (evaluation.triggered && evaluation.reason) {
    shouldNotify = shouldNotifyForReason(
      evaluation.reason,
      targetPriceAlertActive,
      discountAlertActive
    );
    if (shouldNotify) {
      if (evaluation.reason === "target_price") {
        targetPriceAlertActive = true;
      } else {
        discountAlertActive = true;
      }
    }
  }

  return { targetPriceAlertActive, discountAlertActive, shouldNotify };
}

function shouldNotifyForReason(
  reason: AlertTriggerReason,
  targetActive: boolean,
  discountActive: boolean
): boolean {
  if (reason === "target_price") return !targetActive;
  return !discountActive;
}
