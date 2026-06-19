import type { AlertTriggerReason } from "@/lib/pipeline/evaluate-alert";

export function buildAlertMessage(params: {
  currency: string;
  price: number;
  reason: AlertTriggerReason;
  targetPrice: number | null;
  discountPercent: number | null;
  discountAlertPercent: number | null;
  baselinePrice: number | null;
}): string {
  if (params.reason === "target_price" && params.targetPrice !== null) {
    return `Price dropped to ${params.currency} ${params.price} (target: ${params.currency} ${params.targetPrice})`;
  }

  const pct = params.discountPercent?.toFixed(1) ?? "0";
  const baseline = params.baselinePrice ?? 0;
  return `Price dropped ${pct}% to ${params.currency} ${params.price} (from ${params.currency} ${baseline}, alert: ${params.discountAlertPercent}%+ off)`;
}
