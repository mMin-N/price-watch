"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Wishlist } from "@/lib/types/product";

export default function WishlistsPage() {
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadWishlists = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/wishlists");
      const data = (await res.json()) as { wishlists?: Wishlist[]; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to load wishlists");
        return;
      }

      setWishlists(data.wishlists ?? []);
    } catch {
      setError("Failed to load wishlists");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWishlists();
  }, [loadWishlists]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    setActionError(null);

    try {
      const res = await fetch("/api/wishlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as Wishlist & { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to create wishlist");
        return;
      }

      setNewName("");
      await loadWishlists();
    } catch {
      setActionError("Failed to create wishlist");
    } finally {
      setCreating(false);
    }
  }

  function startRename(wishlist: Wishlist) {
    setEditingId(wishlist.id);
    setEditName(wishlist.name);
    setActionError(null);
  }

  function cancelRename() {
    setEditingId(null);
    setEditName("");
  }

  async function handleRename(id: string) {
    const name = editName.trim();
    if (!name) {
      setActionError("Name cannot be empty");
      return;
    }

    setSavingId(id);
    setActionError(null);

    try {
      const res = await fetch(`/api/wishlists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to rename wishlist");
        return;
      }

      setEditingId(null);
      setEditName("");
      await loadWishlists();
    } catch {
      setActionError("Failed to rename wishlist");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete wishlist "${name}"? Products will be ungrouped but not deleted.`)) {
      return;
    }

    setDeletingId(id);
    setActionError(null);

    try {
      const res = await fetch(`/api/wishlists/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setActionError(data.error ?? "Failed to delete wishlist");
        return;
      }

      if (editingId === id) {
        cancelRename();
      }
      await loadWishlists();
    } catch {
      setActionError("Failed to delete wishlist");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Wishlists</h1>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
          New wishlist
        </h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="wishlist-name"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name
            </label>
            <input
              id="wishlist-name"
              type="text"
              placeholder="Holiday gifts"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
      </section>

      {actionError && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading wishlists...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : wishlists.length === 0 ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No wishlists yet. Create one above to group tracked products.
          </p>
        </section>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Name</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Products</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {wishlists.map((wishlist) => (
                <tr
                  key={wishlist.id}
                  className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3">
                    {editingId === wishlist.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="w-full max-w-xs rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    ) : (
                      <Link
                        href={`/wishlists/${wishlist.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {wishlist.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {wishlist.productCount}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {editingId === wishlist.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRename(wishlist.id)}
                            disabled={savingId === wishlist.id}
                            className="text-sm font-medium text-zinc-700 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-zinc-50"
                          >
                            {savingId === wishlist.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            disabled={savingId === wishlist.id}
                            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href={`/wishlists/${wishlist.id}`}
                            className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                          >
                            Open
                          </Link>
                          <button
                            type="button"
                            onClick={() => startRename(wishlist)}
                            className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(wishlist.id, wishlist.name)}
                            disabled={deletingId === wishlist.id}
                            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                          >
                            {deletingId === wishlist.id ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
