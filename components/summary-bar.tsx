import Link from "next/link";

type SummaryBarProps = {
  priceDropCount: number;
  unreadCount: number;
};

export function SummaryBar({ priceDropCount, unreadCount }: SummaryBarProps) {
  if (priceDropCount === 0 && unreadCount === 0) {
    return null;
  }

  const parts: { label: string; href: string }[] = [];

  if (priceDropCount > 0) {
    parts.push({
      label: `${priceDropCount} price drop${priceDropCount === 1 ? "" : "s"}`,
      href: "/",
    });
  }

  if (unreadCount > 0) {
    parts.push({
      label: `${unreadCount} unread`,
      href: "/notifications",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-accent/30 bg-amber-50/80 px-4 py-3 text-sm">
      {parts.map((part, index) => (
        <span key={part.href + part.label} className="inline-flex items-center gap-2">
          {index > 0 ? (
            <span className="text-muted" aria-hidden>
              ·
            </span>
          ) : null}
          <Link href={part.href} className="font-medium text-brand-purple hover:text-brand-pink">
            {part.label}
          </Link>
        </span>
      ))}
    </div>
  );
}
