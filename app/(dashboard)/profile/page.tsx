"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/profile");
        const data = (await res.json()) as {
          email?: string;
          emailVerified?: boolean;
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "Failed to load profile");
          return;
        }
        if (!cancelled) {
          setEmail(data.email ?? null);
          setEmailVerified(data.emailVerified ?? false);
        }
      } catch {
        if (!cancelled) setError("Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
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
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Profile</h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</h2>
            <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">{email ?? "—"}</p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Verification
            </h2>
            <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
              {emailVerified ? "Verified" : "Not verified — check your inbox"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </section>
      )}
    </div>
  );
}
