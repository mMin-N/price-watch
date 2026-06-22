export type AlertTriggerReason = "discount_percent";

export type AlertEvaluation = {
  triggered: boolean;
  reason: AlertTriggerReason | null;
  discountPercent: number | null;
};

export function computeDiscountPercent(baselinePrice: number, currentPrice: number): number {
  if (baselinePrice <= 0) return 0;
  return ((baselinePrice - currentPrice) / baselinePrice) * 100;
}

/**
 * Notifies when price drops below baseline.
 * `discountAlertPercent` null = any drop; otherwise requires at least that % off baseline.
 */
export function evaluateAlert(
  price: number,
  discountAlertPercent: number | null,
  baselinePrice: number | null
): AlertEvaluation {
  if (baselinePrice === null || baselinePrice <= 0 || price >= baselinePrice) {
    return { triggered: false, reason: null, discountPercent: null };
  }

  const discountPercent = computeDiscountPercent(baselinePrice, price);
  const threshold = discountAlertPercent ?? 0;

  if (discountPercent > 0 && discountPercent >= threshold) {
    return {
      triggered: true,
      reason: "discount_percent",
      discountPercent,
    };
  }

  return { triggered: false, reason: null, discountPercent: null };
}

/** @deprecated Use evaluateAlert */
export function shouldTriggerAlert(price: number, targetPrice: number | null): boolean {
  if (targetPrice === null) return false;
  return price <= targetPrice;
}
