"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notification-bell";
import { UserProfileMenu } from "@/components/user-profile-menu";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/wishlists", label: "Wishlists" },
  { href: "/notifications", label: "Notifications" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unreadOnly=true");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: unknown[] };
      setUnreadCount(data.notifications?.length ?? 0);
    } catch {
      // ignore fetch errors for badge count
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cancelled) return;
      await fetchUnreadCount();
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname, fetchUnreadCount]);

  return (
    <header
      className="sticky top-0 z-[100] border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
      data-user-chrome
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link
            href="/"
            className="shrink-0 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Price Watch
          </Link>

          <div
            className="flex shrink-0 items-center gap-2 sm:gap-3"
            data-user-chrome
          >
            <UserProfileMenu />
            <NotificationBell unreadCount={unreadCount} />
          </div>
        </div>

        <nav className="-mx-4 hidden items-center gap-4 overflow-x-auto border-t border-zinc-100 px-4 py-2 sm:mx-0 sm:gap-6 sm:border-t-0 sm:px-0 sm:py-0 sm:pb-3 md:flex dark:border-zinc-800">
          {navLinks.map(({ href, label }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 text-sm font-medium whitespace-nowrap ${
                  isActive
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
