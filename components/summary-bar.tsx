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
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      {parts.map((part, index) => (
        <span key={part.href + part.label} className="inline-flex items-center gap-2">
          {index > 0 ? (
            <span className="text-zinc-400 dark:text-zinc-500" aria-hidden>
              ·
            </span>
          ) : null}
          <Link
            href={part.href}
            className="font-medium text-zinc-800 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-zinc-50"
          >
            {part.label}
          </Link>
        </span>
      ))}
    </div>
  );
}
