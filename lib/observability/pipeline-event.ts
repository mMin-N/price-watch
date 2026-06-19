import type { SupabaseClient } from "@supabase/supabase-js";

export type PipelineEventStep = "fetch" | "normalize" | "persist" | "alert" | "preview";

export async function logPipelineEvent(
  supabase: SupabaseClient,
  params: {
    trackedProductId?: string | null;
    site: string;
    step: PipelineEventStep;
    success: boolean;
    durationMs?: number;
    errorCode?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("pipeline_events").insert({
    tracked_product_id: params.trackedProductId ?? null,
    site: params.site,
    step: params.step,
    success: params.success,
    duration_ms: params.durationMs ?? null,
    error_code: params.errorCode ?? null,
  });

  if (error) {
    console.error(
      JSON.stringify({
        step: "pipeline_event_log_failed",
        error: error.message,
        site: params.site,
      })
    );
  }
}
