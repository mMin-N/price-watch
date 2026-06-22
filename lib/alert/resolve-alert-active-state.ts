import {
  computeDiscountPercent,
  type AlertEvaluation,
} from "@/lib/pipeline/evaluate-alert";

export type AlertActiveState = {
  targetPriceAlertActive: boolean;
  discountAlertActive: boolean;
  shouldNotify: boolean;
};

export function resolveAlertActiveState(
  price: number,
  discountAlertPercent: number | null,
  baselinePrice: number | null,
  currentDiscountActive: boolean,
  evaluation: AlertEvaluation
): AlertActiveState {
  let discountAlertActive = currentDiscountActive;

  if (baselinePrice === null || baselinePrice <= 0 || price >= baselinePrice) {
    discountAlertActive = false;
  } else {
    const discountPercent = computeDiscountPercent(baselinePrice, price);
    const threshold = discountAlertPercent ?? 0;
    if (discountPercent <= 0 || discountPercent < threshold) {
      discountAlertActive = false;
    }
  }

  let shouldNotify = false;
  if (evaluation.triggered && evaluation.reason === "discount_percent") {
    shouldNotify = !discountAlertActive;
    if (shouldNotify) {
      discountAlertActive = true;
    }
  }

  return {
    targetPriceAlertActive: false,
    discountAlertActive,
    shouldNotify,
  };
}
