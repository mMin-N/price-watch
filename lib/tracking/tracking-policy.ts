import type { SupportedSite } from "@/lib/providers/detect-site";

export const MAX_TRACKED_PRODUCTS_PER_USER = 5;
export const DEFAULT_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const SLOW_SITE_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const USER_INACTIVITY_PAUSE_MS = 72 * 60 * 60 * 1000;
export const MAX_CONSECUTIVE_FAILURES = 3;
export const CRON_BATCH_LIMIT = 50;

const SLOW_REFRESH_SITES: SupportedSite[] = ["ebay", "meesho"];

export function refreshIntervalMsForSite(site: SupportedSite): number {
  return SLOW_REFRESH_SITES.includes(site)
    ? SLOW_SITE_REFRESH_INTERVAL_MS
    : DEFAULT_REFRESH_INTERVAL_MS;
}

export function isDueForRefresh(
  lastFetchedAt: string | null | undefined,
  site: SupportedSite,
  nowMs = Date.now()
): boolean {
  if (!lastFetchedAt) return true;
  const elapsed = nowMs - new Date(lastFetchedAt).getTime();
  return elapsed >= refreshIntervalMsForSite(site);
}

export function isUserActive(
  lastActiveAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!lastActiveAt) return false;
  return nowMs - new Date(lastActiveAt).getTime() < USER_INACTIVITY_PAUSE_MS;
}

export function isAutoRefreshPaused(consecutiveFailures: number): boolean {
  return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
}
