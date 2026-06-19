import type { SupabaseClient } from "@supabase/supabase-js";

const LOCK_MS = 60_000;

export class PipelineBusyError extends Error {
  constructor() {
    super("Price update already in progress");
    this.name = "PipelineBusyError";
  }
}

export async function acquirePipelineLock(
  supabase: SupabaseClient,
  trackedProductId: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  const lockUntilIso = new Date(Date.now() + LOCK_MS).toISOString();

  const { data, error } = await supabase
    .from("tracked_products")
    .update({ pipeline_lock_until: lockUntilIso })
    .eq("id", trackedProductId)
    .or(`pipeline_lock_until.is.null,pipeline_lock_until.lt.${nowIso}`)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to acquire pipeline lock: ${error.message}`);
  }
  if (!data) {
    throw new PipelineBusyError();
  }
}

export async function releasePipelineLock(
  supabase: SupabaseClient,
  trackedProductId: string
): Promise<void> {
  const { error } = await supabase
    .from("tracked_products")
    .update({ pipeline_lock_until: null })
    .eq("id", trackedProductId);

  if (error) {
    console.error(
      JSON.stringify({
        step: "pipeline_lock_release",
        trackedProductId,
        error: error.message,
      })
    );
  }
}
