import { verifyCronAuth } from "@/lib/api/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPriceProvider } from "@/lib/providers/get-price-provider";
import { detectSite } from "@/lib/providers/detect-site";
import { runPricePipeline } from "@/lib/pipeline/run-price-pipeline";
import { PipelineBusyError } from "@/lib/pipeline/pipeline-lock";
import { recordFetchFailure } from "@/lib/tracking/record-fetch-outcome";
import {
  CRON_BATCH_LIMIT,
  isAutoRefreshPaused,
  isDueForRefresh,
  MAX_CONSECUTIVE_FAILURES,
  USER_INACTIVITY_PAUSE_MS,
} from "@/lib/tracking/tracking-policy";

type CronProductRow = {
  id: string;
  url: string;
  last_fetched_at: string | null;
  consecutive_failures: number;
  user_id: string;
};

export async function POST(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const inactivityCutoff = new Date(Date.now() - USER_INACTIVITY_PAUSE_MS).toISOString();

  const { data: activeProfiles, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .gte("last_active_at", inactivityCutoff);

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  const activeUserIds = (activeProfiles ?? []).map((p) => p.id);
  if (activeUserIds.length === 0) {
    const result = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
    await logCronRun(supabase, result);
    return Response.json(result);
  }

  const { data: candidates, error: queryError } = await supabase
    .from("tracked_products")
    .select("id, url, last_fetched_at, consecutive_failures, user_id")
    .in("user_id", activeUserIds)
    .lt("consecutive_failures", MAX_CONSECUTIVE_FAILURES)
    .order("last_fetched_at", { ascending: true, nullsFirst: true })
    .limit(200);

  if (queryError) {
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  const due = (candidates ?? []).filter((row: CronProductRow) => {
    if (isAutoRefreshPaused(row.consecutive_failures)) return false;
    return isDueForRefresh(row.last_fetched_at, detectSite(row.url));
  });

  const products = due.slice(0, CRON_BATCH_LIMIT);
  const provider = createPriceProvider();
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const p of products) {
    try {
      await runPricePipeline(supabase, p.id, provider);
      succeeded++;
    } catch (err) {
      if (err instanceof PipelineBusyError) {
        skipped++;
      } else {
        failed++;
        await recordFetchFailure(supabase, p.id);
      }
    }
  }

  const result = {
    processed: products.length,
    succeeded,
    failed,
    skipped,
    eligible: due.length,
    inactiveUsersSkipped: activeUserIds.length === 0,
  };

  await logCronRun(supabase, result);

  return Response.json(result);
}

async function logCronRun(
  supabase: ReturnType<typeof createAdminClient>,
  result: { processed: number; succeeded: number; failed: number; skipped: number }
) {
  await supabase.from("cron_runs").insert({
    job_name: "refresh-prices",
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    skipped: result.skipped,
  });
}
