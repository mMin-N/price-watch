import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeProductUrl, urlsMatchForTracking } from "@/lib/url/normalize-product-url";

export async function findTrackedProductByUrl(
  supabase: SupabaseClient,
  userId: string,
  url: string
): Promise<{ id: string; url: string } | null> {
  const { data, error } = await supabase
    .from("tracked_products")
    .select("id, url")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const match = (data ?? []).find((row) => urlsMatchForTracking(row.url, url));
  return match ?? null;
}

export function canonicalUrlForStorage(url: string): string {
  return normalizeProductUrl(url);
}
