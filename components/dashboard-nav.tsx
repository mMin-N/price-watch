"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
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
    <header className="topper sticky top-0 z-[100] shadow-md" data-user-chrome>
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold text-white">
            <Image src="/icon.png" alt="" width={28} height={28} className="rounded-md ring-1 ring-white/20" />
            Dropt
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3" data-user-chrome>
            <UserProfileMenu />
            <NotificationBell unreadCount={unreadCount} />
          </div>
        </div>

        <nav className="-mx-4 flex items-center gap-4 overflow-x-auto border-t border-white/10 px-4 py-2 sm:mx-0 sm:gap-6 sm:px-0 sm:py-0 sm:pb-3">
          {navLinks.map(({ href, label }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "text-brand-accent"
                    : "text-white/75 hover:text-white"
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
