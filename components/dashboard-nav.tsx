"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/notification-bell";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/wishlists", label: "Wishlists" },
  { href: "/notifications", label: "Notifications" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchUnreadCount() {
      try {
        const res = await fetch("/api/notifications?unreadOnly=true");
        if (!res.ok) return;
        const data = (await res.json()) as { notifications?: unknown[] };
        if (!cancelled) {
          setUnreadCount(data.notifications?.length ?? 0);
        }
      } catch {
        // ignore fetch errors for badge count
      }
    }

    fetchUnreadCount();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Price Watch
        </Link>
        <nav className="flex flex-1 items-center gap-6">
          {navLinks.map(({ href, label }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium ${
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
        <div className="flex items-center gap-4">
          <NotificationBell unreadCount={unreadCount} />
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
