import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_WISHLIST_NAME = "Other";

export async function ensureDefaultWishlist(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string }> {
  const { data: existing, error: fetchError } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (existing?.id) {
    return { id: existing.id };
  }

  const { data: created, error: insertError } = await supabase
    .from("wishlist_items")
    .insert({ user_id: userId, name: DEFAULT_WISHLIST_NAME, is_default: true })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return { id: created.id };
}
