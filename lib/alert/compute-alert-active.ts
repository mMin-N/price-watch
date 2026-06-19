import { evaluateAlert } from "@/lib/pipeline/evaluate-alert";
import type { ProductRow } from "@/lib/api/product-map";

export type AvailabilityStatus = "in_stock" | "out_of_stock" | "unknown";

export function availabilityFromFetch(isAvailable?: boolean): AvailabilityStatus {
  if (isAvailable === false) return "out_of_stock";
  if (isAvailable === true) return "in_stock";
  return "unknown";
}

export function computeAlertActive(row: ProductRow): boolean {
  if (row.last_price === null) return false;
  if ((row.availability_status ?? "unknown") === "out_of_stock") return false;
  return evaluateAlert(
    row.last_price,
    row.target_price,
    row.discount_alert_percent,
    row.baseline_price
  ).triggered;
}
