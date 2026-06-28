"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const tabs = [
  { href: "/", label: "Products", match: (p: string) => p === "/" },
  {
    href: "/wishlists",
    label: "Lists",
    match: (p: string) => p.startsWith("/wishlists"),
  },
  {
    href: "/notifications",
    label: "Alerts",
    match: (p: string) => p.startsWith("/notifications"),
  },
  {
    href: "/profile",
    label: "Profile",
    match: (p: string) => p.startsWith("/profile"),
  },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unreadOnly=true");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: unknown[] };
      setUnreadCount(data.notifications?.length ?? 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [pathname, fetchUnreadCount]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[200] flex border-t border-border bg-white shadow-[0_-4px_20px_rgba(26,15,46,0.06)] lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-user-chrome
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map(({ href, label, match }) => {
          const active = match(pathname);
          const showBadge = href === "/notifications" && unreadCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex min-h-14 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium ${
                active ? "text-brand-purple" : "text-muted hover:text-brand-purple"
              }`}
            >
              <span
                className={`${active ? "border-b-2 border-brand-accent pb-0.5" : ""}`}
              >
                {label}
              </span>
              {showBadge ? (
                <span className="absolute top-2 right-1/4 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-pink px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
