export function shouldTriggerAlert(price: number, targetPrice: number | null): boolean {
  if (targetPrice === null) return false;
  return price <= targetPrice;
}
