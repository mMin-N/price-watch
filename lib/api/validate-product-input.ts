import type { SupabaseClient } from "@supabase/supabase-js";

export function parseOptionalPrice(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "invalid";
  return value;
}

export function parseDiscountAlertPercent(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100) {
    return "invalid";
  }
  return value;
}

export async function validateOwnedWishlistItem(
  supabase: SupabaseClient,
  userId: string,
  wishlistItemId: string | null | undefined
): Promise<string | null> {
  if (wishlistItemId === undefined || wishlistItemId === null || wishlistItemId === "") {
    return null;
  }
  if (typeof wishlistItemId !== "string") {
    return "wishlistItemId must be a string";
  }

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("id", wishlistItemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return "Wishlist not found";
  }
  return null;
}
