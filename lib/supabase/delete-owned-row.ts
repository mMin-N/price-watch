import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Delete a row owned by userId. Uses service role after ownership is verified,
 * because user-scoped DELETE is often blocked by incomplete RLS on hosted Supabase.
 */
export async function deleteOwnedRow(
  table: "tracked_products",
  id: string,
  userId: string
): Promise<{ deleted: boolean; error: string | null }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(table)
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { deleted: false, error: error.message };
  }

  return { deleted: !!data, error: null };
}

/** Roll back a freshly inserted product when pipeline fails. */
export async function rollbackInsertedProduct(
  _userClient: SupabaseClient,
  productId: string,
  userId: string
) {
  await deleteOwnedRow("tracked_products", productId, userId);
}
