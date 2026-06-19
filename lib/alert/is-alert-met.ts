import { evaluateAlert } from "@/lib/pipeline/evaluate-alert";
import type { Product } from "@/lib/types/product";

export function isAlertConditionMet(product: Product): boolean {
  if (product.lastPrice === null) return false;
  return evaluateAlert(
    product.lastPrice,
    product.targetPrice,
    product.discountAlertPercent,
    product.baselinePrice
  ).triggered;
}
