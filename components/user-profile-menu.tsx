"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return local.slice(0, 1).toUpperCase();
}

function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.418 0-8 2.015-8 4.5V20h16v-1.5c0-2.485-3.582-4.5-8-4.5Z" />
    </svg>
  );
}

function avatarUrlFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata) return null;
  const picture = metadata.picture ?? metadata.avatar_url;
  return typeof picture === "string" && picture.length > 0 ? picture : null;
}

export function UserProfileMenu() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setAvatarUrl(avatarUrlFromMetadata(data.user?.user_metadata));
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  const label = email ?? "Account";
  const initials = email ? initialsFromEmail(email) : null;

  return (
    <div ref={rootRef} className="relative shrink-0" data-user-chrome>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 py-1 pl-1 pr-2 shadow-sm transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple sm:pr-3"
        aria-label="Open account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        title={label}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-accent text-sm font-semibold text-brand-purple-dark ring-2 ring-white/30">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : initials ? (
            initials
          ) : (
            <UserIcon />
          )}
        </span>
        <span className="hidden max-w-[8rem] truncate text-sm font-medium text-white/90 sm:inline">
          {email ?? "Account"}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[200] mt-2 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Signed in as
            </p>
            <p className="mt-1 truncate text-sm text-zinc-900 dark:text-zinc-50">{label}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
