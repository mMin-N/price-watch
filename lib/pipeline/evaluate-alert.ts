export type AlertTriggerReason = "target_price" | "discount_percent";

export type AlertEvaluation = {
  triggered: boolean;
  reason: AlertTriggerReason | null;
  discountPercent: number | null;
};

export function computeDiscountPercent(baselinePrice: number, currentPrice: number): number {
  if (baselinePrice <= 0) return 0;
  return ((baselinePrice - currentPrice) / baselinePrice) * 100;
}

export function evaluateAlert(
  price: number,
  targetPrice: number | null,
  discountAlertPercent: number | null,
  baselinePrice: number | null
): AlertEvaluation {
  if (targetPrice !== null && price <= targetPrice) {
    return {
      triggered: true,
      reason: "target_price",
      discountPercent:
        baselinePrice !== null ? computeDiscountPercent(baselinePrice, price) : null,
    };
  }

  if (
    discountAlertPercent !== null &&
    discountAlertPercent > 0 &&
    baselinePrice !== null &&
    baselinePrice > 0
  ) {
    const discountPercent = computeDiscountPercent(baselinePrice, price);
    if (discountPercent >= discountAlertPercent) {
      return {
        triggered: true,
        reason: "discount_percent",
        discountPercent,
      };
    }
  }

  return { triggered: false, reason: null, discountPercent: null };
}

/** @deprecated Use evaluateAlert */
export function shouldTriggerAlert(price: number, targetPrice: number | null): boolean {
  return evaluateAlert(price, targetPrice, null, null).triggered;
}
