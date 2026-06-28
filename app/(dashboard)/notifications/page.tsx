"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Notification = {
  id: string;
  trackedProductId: string | null;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function isUnread(notification: Notification) {
  return notification.readAt === null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as {
        notifications?: Notification[];
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Failed to load notifications");
        return;
      }

      setNotifications(data.notifications ?? []);
    } catch {
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter(isUnread).length;

  async function handleMarkRead(id: string) {
    setMarkingId(id);
    setActionError(null);

    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      const data = (await res.json()) as Notification & { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to mark notification as read");
        return;
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: data.readAt } : n))
      );
    } catch {
      setActionError("Failed to mark notification as read");
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    setActionError(null);

    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to mark all as read");
        return;
      }

      await loadNotifications();
    } catch {
      setActionError("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Notifications
        </h1>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {markingAll ? "Marking all read..." : "Mark all read"}
          </button>
        )}
      </div>

      {actionError && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading notifications...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : notifications.length === 0 ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No notifications yet. You will see price alerts here when a product reaches your
            target price.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {notifications.map((notification) => {
              const unread = isUnread(notification);
              const content = (
                <>
                  <p
                    className={
                      unread
                        ? "font-semibold text-zinc-900 dark:text-zinc-50"
                        : "text-zinc-700 dark:text-zinc-300"
                    }
                  >
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(notification.createdAt)}
                  </p>
                </>
              );

              return (
                <li
                  key={notification.id}
                  className={
                    unread
                      ? "bg-zinc-50 px-4 py-4 dark:bg-zinc-900"
                      : "px-4 py-4"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {notification.trackedProductId ? (
                        <Link
                          href={`/products/${notification.trackedProductId}`}
                          className="block hover:underline"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </div>
                    {unread && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(notification.id)}
                        disabled={markingId === notification.id}
                        className="shrink-0 text-sm font-medium text-zinc-700 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-zinc-50"
                      >
                        {markingId === notification.id ? "Marking..." : "Mark read"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
