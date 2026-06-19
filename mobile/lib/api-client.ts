import { supabase } from "./supabase";

const API_BASE = process.env.EXPO_PUBLIC_API_URL!;

export async function apiFetch(path: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    const {
      data: { session: refreshed },
    } = await supabase.auth.refreshSession();
    if (refreshed?.access_token) {
      headers.set("Authorization", `Bearer ${refreshed.access_token}`);
      return fetch(`${API_BASE}${path}`, { ...init, headers });
    }
  }

  return res;
}
