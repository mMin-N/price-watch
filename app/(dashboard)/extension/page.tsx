"use client";

import { useCallback, useState } from "react";

export default function ExtensionConnectPage() {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const res = await fetch("/api/extension/token");
      const data = (await res.json()) as {
        accessToken?: string;
        expiresAt?: number | null;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Failed to load token");
        setToken(null);
        return;
      }

      setToken(data.accessToken ?? null);
      setExpiresAt(data.expiresAt ?? null);
    } catch {
      setError("Failed to load token");
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
  }

  const expiryLabel =
    expiresAt !== null
      ? new Date(expiresAt * 1000).toLocaleString()
      : "Unknown";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Chrome extension
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Connect the Price Watch browser extension to your account. Copy the access token
          below and paste it into the extension popup under API settings.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={loadToken}
          disabled={loading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Loading…" : "Generate access token"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        {token ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-zinc-500">Expires: {expiryLabel}</p>
            <textarea
              readOnly
              value={token}
              rows={4}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={copyToken}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              {copied ? "Copied" : "Copy token"}
            </button>
          </div>
        ) : null}
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        <li>Load the unpacked extension from the <code>extension/</code> folder.</li>
        <li>Set <code>BACKEND_URL</code> in <code>extension/config.js</code> if not using localhost.</li>
        <li>Open the extension popup → API settings → paste the token → Save.</li>
        <li>Add Amazon products and click Refresh all to sync prices.</li>
      </ol>
    </div>
  );
}
