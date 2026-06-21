const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

function formatUsdAmount(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  if (diff < MS_MINUTE) return "just now";
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MINUTE)}m ago`;
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)}h ago`;
  if (diff < MS_DAY * 2) return "yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(iso)
  );
}

export type PriceChangeDisplay = {
  text: string;
  direction: "down" | "up" | "flat";
};

export function formatPriceChange(
  amount: number | null,
  percent: number | null,
  currency: string
): PriceChangeDisplay | null {
  if (amount === null) return null;
  const direction: PriceChangeDisplay["direction"] =
    amount < 0 ? "down" : amount > 0 ? "up" : "flat";
  const arrow = direction === "down" ? "↓" : direction === "up" ? "↑" : "→";
  const absAmount = formatUsdAmount(amount, currency);
  const pct =
    percent !== null && Number.isFinite(percent)
      ? ` (${Math.abs(percent).toFixed(1)}%)`
      : "";
  return { text: `${arrow} ${absAmount}${pct}`, direction };
}

export type DistanceDisplay = { text: string; met: boolean };

export function formatDistanceToTarget(
  distance: number | null,
  currency: string
): DistanceDisplay | null {
  if (distance === null) return null;
  if (distance <= 0) return { text: "Target met!", met: true };
  return {
    text: `${formatUsdAmount(distance, currency)} above target`,
    met: false,
  };
}
