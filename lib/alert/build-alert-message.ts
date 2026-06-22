export function buildAlertMessage(params: {
  currency: string;
  price: number;
  discountPercent: number | null;
  discountAlertPercent: number | null;
  baselinePrice: number | null;
}): string {
  const pct = params.discountPercent?.toFixed(1) ?? "0";
  const baseline = params.baselinePrice ?? 0;
  const thresholdText =
    params.discountAlertPercent !== null
      ? `${params.discountAlertPercent}%+ off`
      : "any drop";
  return `Price dropped ${pct}% to ${params.currency} ${params.price} (from ${params.currency} ${baseline}, alert: ${thresholdText})`;
}
