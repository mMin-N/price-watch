import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_CONSECUTIVE_FAILURES } from "./tracking-policy";

export async function recordFetchSuccess(
  supabase: SupabaseClient,
  trackedProductId: string
): Promise<void> {
  const { error } = await supabase
    .from("tracked_products")
    .update({ consecutive_failures: 0 })
    .eq("id", trackedProductId);

  if (error) {
    console.error(
      JSON.stringify({
        step: "record_fetch_success",
        trackedProductId,
        error: error.message,
      })
    );
  }
}

export async function recordFetchFailure(
  supabase: SupabaseClient,
  trackedProductId: string
): Promise<number> {
  const { data: product, error: loadError } = await supabase
    .from("tracked_products")
    .select("consecutive_failures")
    .eq("id", trackedProductId)
    .single();

  if (loadError || !product) {
    console.error(
      JSON.stringify({
        step: "record_fetch_failure",
        trackedProductId,
        error: loadError?.message ?? "not_found",
      })
    );
    return MAX_CONSECUTIVE_FAILURES;
  }

  const next = (product.consecutive_failures ?? 0) + 1;
  const { error: updateError } = await supabase
    .from("tracked_products")
    .update({ consecutive_failures: next })
    .eq("id", trackedProductId);

  if (updateError) {
    console.error(
      JSON.stringify({
        step: "record_fetch_failure",
        trackedProductId,
        error: updateError.message,
      })
    );
  }

  return next;
}
