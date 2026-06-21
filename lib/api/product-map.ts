import { APP_CURRENCY } from "@/lib/providers/normalize-price";
import { detectSite, siteDisplayName } from "@/lib/providers/detect-site";
import { computeAlertActive, type AvailabilityStatus } from "@/lib/alert/compute-alert-active";
import { isAutoRefreshPaused } from "@/lib/tracking/tracking-policy";

export const PRODUCT_COLUMNS =
  "id, url, title, target_price, discount_alert_percent, baseline_price, currency, last_price, last_fetched_at, wishlist_item_id, availability_status, consecutive_failures, created_at, updated_at";

export type ProductRow = {
  id: string;
  url: string;
  title: string | null;
  target_price: number | null;
  discount_alert_percent: number | null;
  baseline_price: number | null;
  currency: string | null;
  last_price: number | null;
  last_fetched_at: string | null;
  wishlist_item_id: string | null;
  availability_status: AvailabilityStatus;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
};

function computePriceChange(lastPrice: number | null, baselinePrice: number | null) {
  if (lastPrice === null || baselinePrice === null) {
    return { priceChange: null, priceChangePercent: null };
  }
  const priceChange = lastPrice - baselinePrice;
  const priceChangePercent =
    baselinePrice > 0 ? (priceChange / baselinePrice) * 100 : null;
  return { priceChange, priceChangePercent };
}

function computeDistanceToTarget(lastPrice: number | null, targetPrice: number | null) {
  if (lastPrice === null || targetPrice === null) {
    return { distanceToTarget: null, targetMet: false };
  }
  const distanceToTarget = lastPrice - targetPrice;
  return { distanceToTarget, targetMet: lastPrice <= targetPrice };
}

export function mapProduct(row: ProductRow) {
  const site = detectSite(row.url);
  const { priceChange, priceChangePercent } = computePriceChange(
    row.last_price,
    row.baseline_price
  );
  const { distanceToTarget, targetMet } = computeDistanceToTarget(
    row.last_price,
    row.target_price
  );

  return {
    id: row.id,
    url: row.url,
    title: row.title,
    targetPrice: row.target_price,
    discountAlertPercent: row.discount_alert_percent,
    baselinePrice: row.baseline_price,
    currency: APP_CURRENCY,
    lastPrice: row.last_price,
    lastFetchedAt: row.last_fetched_at,
    wishlistItemId: row.wishlist_item_id,
    availabilityStatus: row.availability_status ?? "unknown",
    site,
    siteName: siteDisplayName(site),
    alertActive: computeAlertActive(row),
    consecutiveFailures: row.consecutive_failures ?? 0,
    autoRefreshPaused: isAutoRefreshPaused(row.consecutive_failures ?? 0),
    priceChange,
    priceChangePercent,
    distanceToTarget,
    targetMet,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
